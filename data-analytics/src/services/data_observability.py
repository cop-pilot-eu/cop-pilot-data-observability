import json

import nannyml as nml
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
from pandas.tseries.frequencies import to_offset
from scipy import stats

from ..config import Config


class DataObservability:
    BIN_SIZE = 10
    TIME_COL = "time"
    OBSERVED_TIME_COL = "observed_at"
    LATENCY_COL = "latency_ms"
    STD_SUFFIX = "_std"
    COUNT_SUFFIX = "_count"

    def __init__(
        self,
        data_source: pd.DataFrame,
        data_reference: pd.DataFrame,
        interval: pd.Timedelta | None = None,
        analysis_range: tuple | None = None,
        reference_range: tuple | None = None,
    ) -> None:
        """
        interval: one slot of the data (the bucket for resampled data, the native interval for raw data).
        *_range: [start, end) the data was read for. Without them, the data's own first/last timestamps are used.
        """
        self.dataframe_analysis = self._data_preprocessing(self._with_latency(data_source))
        self.dataframe_reference = self._data_preprocessing(self._with_latency(data_reference))
        self.interval = interval
        self.analysis_range = analysis_range
        self.reference_range = reference_range
        # All features feed drift; resampled data adds <attr>_std / <attr>_count next to each attribute
        self.feature_names = [
            col for col in self.dataframe_reference.columns if col not in [self.OBSERVED_TIME_COL, self.LATENCY_COL]
        ]
        derived_columns = {f"{col}{suffix}" for col in self.feature_names for suffix in (self.STD_SUFFIX, self.COUNT_SUFFIX)}
        self.base_feature_names = [col for col in self.feature_names if col not in derived_columns]

    def get_data_quality_report(self) -> dict:
        """
        Get a detailed data quality report for the given time range.
        """
        interval = self.interval
        if interval is None:
            interval = pd.Timedelta(to_offset(self.detect_frequency(self.dataframe_reference.copy(), self.OBSERVED_TIME_COL)))
        expected = self._expected_readings(self.dataframe_reference, self.base_feature_names, interval)
        ref_duration = self._range_duration(self.dataframe_reference, self.reference_range, interval)
        analysis_duration = self._range_duration(self.dataframe_analysis, self.analysis_range, interval)
        ref_completeness, ref_avg_latency = self._calculate_reference_quality(
            self.dataframe_reference, ref_duration, expected, self.LATENCY_COL
        )
        return self._calculate_quality(
            self.dataframe_analysis,
            analysis_duration,
            interval,
            expected,
            self.LATENCY_COL,
            ref_completeness,
            ref_avg_latency,
        )

    @classmethod
    def _range_duration(cls, dataframe: pd.DataFrame, date_range: tuple | None, interval: pd.Timedelta) -> pd.Timedelta:
        # Counted, not reindexed: an exact-match reindex drops every reading that is off the grid by clock jitter
        if date_range is None:
            observed_at = pd.to_datetime(dataframe[cls.OBSERVED_TIME_COL], utc=True)
            date_range = (observed_at.min(), observed_at.max() + interval)
        start, end = date_range
        return end - start

    @classmethod
    def _calculate_quality(
        cls,
        dataframe: pd.DataFrame,
        duration: pd.Timedelta,
        interval: pd.Timedelta,
        expected: dict,
        latency_col: str,
        ref_completeness: float,
        ref_avg_latency: float,
    ) -> dict:
        missing_values, completeness = cls._missing_readings(dataframe, duration, expected)
        avg_latency_ms = dataframe[latency_col].mean().astype(int)
        completeness_diff_percentage = ((completeness - ref_completeness) / ref_completeness) * 100 if ref_completeness > 0 else 0
        avg_latency_diff_percentage = ((avg_latency_ms - ref_avg_latency) / ref_avg_latency) * 100 if ref_avg_latency > 0 else 0
        return {
            "number_of_attributes": len(expected),
            "number_of_records": max(round(duration / interval), 1),
            "total_missing_values": missing_values,
            "completeness_%": round(completeness * 100, 2),
            "avg_latency_ms": int(avg_latency_ms),
            "completeness_diff_percentage": round(float(completeness_diff_percentage), 2),
            "avg_latency_diff_percentage": round(float(avg_latency_diff_percentage), 2),
        }

    @classmethod
    def _calculate_reference_quality(
        cls, dataframe: pd.DataFrame, duration: pd.Timedelta, expected: dict, latency_col: str
    ) -> tuple:
        _, completeness = cls._missing_readings(dataframe, duration, expected)
        avg_latency_ms = dataframe[latency_col].mean().astype(int)
        print(f"Reference Completeness: {completeness}, Reference Avg Latency (ms): {avg_latency_ms}")
        return completeness, avg_latency_ms

    def get_attribute_quality_report(self) -> dict:
        """
        Get a detailed data quality report for the given dataset.
        """
        df = self.dataframe_analysis[self.base_feature_names].copy()
        return self._calculate_feature_stats(df)

    @staticmethod
    def _calculate_feature_stats(dataframe: pd.DataFrame) -> dict:
        stats_dict = {}
        for col in dataframe.columns:
            stats_dict[col] = {
                "dtype": dataframe[col].dtype.name,
                "count": dataframe[col].count().item(),
                "missing": dataframe[col].isna().sum().item(),
                "mean": dataframe[col].mean().item() if is_numeric_dtype(dataframe[col]) else "N/A",
                "min": dataframe[col].min().item() if is_numeric_dtype(dataframe[col]) else "N/A",
                "max": dataframe[col].max().item() if is_numeric_dtype(dataframe[col]) else "N/A",
                "outliers": (np.abs(stats.zscore(dataframe[col], nan_policy="omit")) > 3).sum().item()
                if is_numeric_dtype(dataframe[col])
                else "N/A",
            }
        return stats_dict

    def get_data_distribution_report(self) -> dict:
        columns_to_exclude = [col for col in self.dataframe_reference.columns if col not in self.base_feature_names]
        reference_dist = self._calculate_data_distribution(self.dataframe_reference, self.BIN_SIZE, columns_to_exclude, None)

        temp_df = self.dataframe_reference.loc[:, ~self.dataframe_reference.columns.isin(columns_to_exclude)]
        numerical_features = temp_df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_features = temp_df.select_dtypes(include=["object", "category"]).columns.tolist()
        distributions_dataframe = reference_dist.copy()

        if numerical_features:
            for col in numerical_features:
                col_rows = distributions_dataframe[distributions_dataframe[col].notna()].copy()
                col_rows = col_rows.sort_values("bin_edges")

                analysis_counts = []
                edges = col_rows["bin_edges"].tolist()
                analysis_values = self.dataframe_analysis[col].dropna()

                for i, (lower_limit, upper_limit) in enumerate(edges):
                    if i == 0:
                        count = (analysis_values <= upper_limit).sum()
                    elif i == len(edges) - 1:
                        count = (analysis_values >= lower_limit).sum()
                    else:
                        count = ((analysis_values > lower_limit) & (analysis_values <= upper_limit)).sum()
                    analysis_counts.append(count)

                distributions_dataframe.loc[col_rows.index, f"{col}_analysis"] = analysis_counts

        if categorical_features:
            for col in categorical_features:
                analysis_counts = self.dataframe_analysis[col].value_counts().to_dict()
                distributions_dataframe.loc[distributions_dataframe[col].notna(), f"{col}_analysis"] = (
                    distributions_dataframe.loc[distributions_dataframe[col].notna(), "bin"].map(analysis_counts).fillna(0)
                )

        features = [
            col for col in distributions_dataframe.columns if col not in ["bin", "bin_edges"] and not col.endswith("_analysis")
        ]

        rows = []
        for feat in features:
            feature_analysis_col = f"{feat}_analysis"
            feature_df = distributions_dataframe[["bin", "bin_edges", feat, feature_analysis_col]].dropna(subset=[feat])
            feature_df = feature_df.rename(columns={feat: "reference", feature_analysis_col: "analysis"})
            feature_df.insert(0, "attribute", feat)
            rows.append(feature_df)

        distributions = pd.concat(rows, ignore_index=True)
        return distributions.to_dict(orient="records")

    @staticmethod
    def _calculate_data_distribution(
        dataframe: pd.DataFrame, bin_size: int, columns_to_exclude: list = None, columns_to_include: list = None
    ) -> pd.DataFrame:
        if columns_to_include:
            df = dataframe[columns_to_include]
        elif columns_to_exclude:
            df = dataframe.drop(columns=columns_to_exclude)
        else:
            df = dataframe
        numerical_features = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_features = df.select_dtypes(include=["object", "category"]).columns.tolist()

        feature_dfs = []

        if numerical_features:
            for col in numerical_features:
                counts, bin_edges = np.histogram(df[col].dropna(), bins=bin_size)
                bin_labels = [f"{bin_edges[i]:.2f}-{bin_edges[i + 1]:.2f}" for i in range(len(bin_edges) - 1)]
                feature_dfs.append(
                    pd.DataFrame({"bin": bin_labels, "bin_edges": list(zip(bin_edges[:-1], bin_edges[1:])), col: counts})
                )
        if categorical_features:
            for col in categorical_features:
                value_counts = df[col].value_counts()
                feature_dfs.append(pd.DataFrame({"bin": value_counts.index, "bin_edges": None, col: value_counts.values}))

        result = feature_dfs[0]
        for feature_distribution_df in feature_dfs[1:]:
            result = result.merge(feature_distribution_df, on=["bin", "bin_edges"], how="outer")

        return result

    def get_data_drift_report(self) -> tuple:
        calc = nml.UnivariateDriftCalculator(
            column_names=self.feature_names,
            timestamp_column_name=self.OBSERVED_TIME_COL,
            **self._chunk_kwargs(),
        )
        calc.fit(self.dataframe_reference)

        univariate_results = calc.calculate(self.dataframe_analysis)
        data_drift_df = univariate_results.data
        df_temp_0 = data_drift_df.copy()

        df_temp_0.columns = [col for col in df_temp_0.columns]

        chunk_cols = [col for col in df_temp_0.columns if col[0] == "chunk"]
        unique_metrics = [col for col in df_temp_0.columns if col[0] != "chunk"]

        column_names = set(col[0] for col in unique_metrics)
        metrics = set(col[1] for col in unique_metrics)

        dataframes_to_concat = []
        for column in column_names:
            for metric in metrics:
                result_columns = [col for col in unique_metrics if col[0] == column and col[1] == metric]
                partial_dataframe = df_temp_0[chunk_cols + result_columns].copy()
                partial_dataframe.columns = [col[2] for col in partial_dataframe.columns]

                partial_dataframe["name"] = column
                partial_dataframe["metric"] = metric

                dataframes_to_concat.append(partial_dataframe)

        data_drift_dataset = pd.concat(dataframes_to_concat, ignore_index=True)
        data_drift_dataset.rename(
            columns={
                "chunk_index": "chunk_index",
                "key": "chunk_key",
                "start_index": "chunk_start_index",
                "end_index": "chunk_end_index",
                "start_date": "chunk_start_date",
                "end_date": "chunk_end_date",
                "period": "chunk_period",
            },
            inplace=True,
        )

        data_drift_dataset = data_drift_dataset[
            [
                "chunk_index",
                "chunk_key",
                "chunk_start_index",
                "chunk_end_index",
                "chunk_start_date",
                "chunk_end_date",
                "chunk_period",
                "name",
                "metric",
                "value",
                "upper_threshold",
                "lower_threshold",
                "alert",
            ]
        ]

        column_names = ["name", "value", "metric", "lower_threshold", "upper_threshold", "alert"]
        group_by_columns = [
            "chunk_index",
            "chunk_key",
            "chunk_start_index",
            "chunk_end_index",
            "chunk_start_date",
            "chunk_end_date",
            "chunk_period",
        ]

        temp = data_drift_dataset[data_drift_dataset["chunk_period"] == "analysis"].copy()
        max_value_index = temp.groupby("name")["value"].idxmax()
        drift_summary = temp.loc[max_value_index].copy()
        drift_summary = drift_summary[["chunk_start_date", "chunk_end_date", "name", "value", "upper_threshold", "alert"]]
        data_drift_dataset = (
            data_drift_dataset.groupby(group_by_columns, dropna=False)
            .apply(lambda x: self.create_json_column(x, column_names), include_groups=False)
            .reset_index()
        )
        data_drift_dataset = data_drift_dataset.rename(columns={0: "columns"})

        final_df = data_drift_dataset[data_drift_dataset["chunk_period"] == "analysis"]
        chunks = final_df.to_dict(orient="records")
        self._add_chunk_stats(chunks)
        return chunks, drift_summary.to_dict(orient="records")

    def _add_chunk_stats(self, chunks: list[dict]) -> None:
        """
        Add min / max / mean / outliers of each attribute's analysis values in the chunk to its drift column.
        Outliers are flagged over the whole analysis range (as in the attribute report) and counted per chunk,
        so the chunks of an attribute add up to its total. Derived <attr>_std / <attr>_count columns get none.
        """
        df = self.dataframe_analysis
        observed_at = pd.to_datetime(df[self.OBSERVED_TIME_COL], utc=True)
        numeric = {col for col in self.base_feature_names if is_numeric_dtype(df[col])}
        outlier = {col: np.abs(stats.zscore(df[col], nan_policy="omit")) > 3 for col in numeric}

        for chunk in chunks:
            start = pd.to_datetime(chunk["chunk_start_date"], utc=True)
            end = pd.to_datetime(chunk["chunk_end_date"], utc=True)
            in_chunk = ((observed_at >= start) & (observed_at <= end)).to_numpy()
            for column in chunk["columns"]:
                name = column["name"]
                if name not in self.base_feature_names:
                    continue
                if name not in numeric:
                    column.update(min="N/A", max="N/A", mean="N/A", outliers="N/A")
                    continue
                values = df.loc[in_chunk, name].dropna()
                column.update(
                    min=values.min().item() if len(values) else None,
                    max=values.max().item() if len(values) else None,
                    mean=values.mean().item() if len(values) else None,
                    outliers=int(np.sum(outlier[name][in_chunk])),
                )

    def get_latency_report(self) -> tuple:
        # One row per timestamp (not per attribute), latency column renamed to the report's field name
        baseline_data_source = self.dataframe_reference.rename(columns={self.LATENCY_COL: "latency"})
        baseline_statistics = self._calculate_percentiles(baseline_data_source, "latency")

        analysis_data_source = self.dataframe_analysis.rename(columns={self.LATENCY_COL: "latency"})
        analysis_data_source[self.OBSERVED_TIME_COL] = pd.to_datetime(analysis_data_source[self.OBSERVED_TIME_COL], utc=True)

        analysis_data_source["normal_response"] = analysis_data_source["latency"].apply(
            lambda x: 1 if x <= baseline_statistics["median"] else 0
        )
        analysis_data_source["slower_than_usual_response"] = analysis_data_source["latency"].apply(
            lambda x: 1 if baseline_statistics["median"] < x < baseline_statistics["percentile_95"] else 0
        )
        analysis_data_source["unacceptably_slow_response"] = analysis_data_source["latency"].apply(
            lambda x: 1 if x >= baseline_statistics["percentile_95"] else 0
        )
        analysis_data_source = analysis_data_source[
            ["observed_at", "latency", "normal_response", "slower_than_usual_response", "unacceptably_slow_response"]
        ]
        # Analysis responses per bucket, split at the reference median and p95, with the
        # observed latency range in each (None when the bucket is empty)
        latency_distribution = {}
        for col in ["normal_response", "slower_than_usual_response", "unacceptably_slow_response"]:
            latencies = analysis_data_source.loc[analysis_data_source[col] == 1, "latency"]
            latency_distribution[col] = {
                "count": len(latencies),
                "min_ms": latencies.min().item() if len(latencies) else None,
                "max_ms": latencies.max().item() if len(latencies) else None,
            }

        return latency_distribution, analysis_data_source.to_dict(orient="records")

    def get_multivariate_drift_report(self) -> dict:
        calc = nml.DataReconstructionDriftCalculator(
            column_names=self.feature_names,
            timestamp_column_name=self.OBSERVED_TIME_COL,
            **self._chunk_kwargs(),
        )
        calc.fit(self.dataframe_reference)

        multivariate_results = calc.calculate(self.dataframe_analysis)
        multivariate_results_df = multivariate_results.data

        multivariate_drift_dataset = multivariate_results_df.copy()

        multivariate_drift_dataset["reconstruction_error_json"] = multivariate_drift_dataset.apply(
            lambda row: json.dumps(
                {
                    "value": row[("reconstruction_error", "value")],
                    "sampling_error": row[("reconstruction_error", "sampling_error")],
                    "lower_threshold": row[("reconstruction_error", "lower_threshold")],
                    "upper_threshold": row[("reconstruction_error", "upper_threshold")],
                    "alert": row[("reconstruction_error", "alert")],
                }
            ),
            axis=1,
        )

        multivariate_drift_dataset.columns = [col[1] if col[1] else col[0] for col in multivariate_drift_dataset.columns]

        multivariate_drift_dataset = multivariate_drift_dataset.reset_index(drop=True)
        columns_to_drop = [
            "value",
            "sampling_error",
            "upper_confidence_boundary",
            "lower_confidence_boundary",
            "upper_threshold",
            "lower_threshold",
            "alert",
        ]
        multivariate_drift_dataset = multivariate_drift_dataset.drop(columns=columns_to_drop)
        multivariate_drift_dataset.rename(
            columns={
                "reconstruction_error_json": "reconstruction_error",
                "key": "chunk_key",
                "start_index": "chunk_start_index",
                "end_index": "chunk_end_index",
                "start_date": "chunk_start_date",
                "end_date": "chunk_end_date",
                "period": "chunk_period",
            },
            inplace=True,
        )
        final_df = multivariate_drift_dataset[multivariate_drift_dataset["chunk_period"] == "analysis"]
        return final_df.to_dict(orient="records")

    ### Helper functions ###

    @staticmethod
    def _chunk_kwargs() -> dict:
        if Config.chunk_by == "period":
            return {"chunk_period": Config.chunk_period}
        return {"chunk_size": Config.chunk_size}

    @staticmethod
    def create_json_column(df: pd.DataFrame, column_list: list) -> pd.Series:
        return df[column_list].to_dict("records")

    @classmethod
    def _with_latency(cls, dataframe: pd.DataFrame) -> pd.DataFrame:
        # Resampled data carries latency_ms per bucket; raw data derives it from its two timestamps
        if cls.LATENCY_COL in dataframe.columns:
            return dataframe
        dataframe = dataframe.copy()
        observed_at = pd.to_datetime(dataframe[cls.OBSERVED_TIME_COL], utc=True)
        received_at = pd.to_datetime(dataframe[cls.TIME_COL], utc=True)
        dataframe[cls.LATENCY_COL] = np.abs(received_at - observed_at).dt.total_seconds() * 1000
        return dataframe

    @classmethod
    def _expected_readings(cls, reference: pd.DataFrame, attrs: list, interval: pd.Timedelta) -> dict:
        """
        attr -> (readings per slot, slot length), both taken from the reference.
        Bucketed: the median count of the non-empty buckets per bucket. Raw: one reading per the attribute's own
        median gap, since attributes with staggered timestamps report less often than the entity as a whole.
        """
        expected = {}
        for attr in attrs:
            count_col = f"{attr}{cls.COUNT_SUFFIX}"
            if count_col in reference.columns:
                counts = reference[count_col]
                expected[attr] = (float(counts[counts > 0].median()), interval)
            else:
                observed_at = pd.to_datetime(reference.loc[reference[attr].notna(), cls.OBSERVED_TIME_COL], utc=True)
                gaps = observed_at.sort_values().diff()
                gaps = gaps[gaps > pd.Timedelta(0)]
                expected[attr] = (1.0, max(gaps.median(), interval) if len(gaps) else interval)
        return expected

    @classmethod
    def _missing_readings(cls, dataframe: pd.DataFrame, duration: pd.Timedelta, expected: dict) -> tuple:
        # Slots without a row hold no readings, so they only add to the expected total
        observed = expected_total = 0.0
        for attr, (per_slot, slot) in expected.items():
            count_col = f"{attr}{cls.COUNT_SUFFIX}"
            if count_col in dataframe.columns:
                counts = dataframe[count_col].fillna(0)
            else:
                counts = dataframe[attr].notna().astype(int)
            attr_expected = per_slot * max(round(duration / slot), 1)
            observed += min(counts.clip(upper=per_slot).sum(), attr_expected)
            expected_total += attr_expected
        missing = expected_total - observed
        return int(round(missing)), float(1 - missing / expected_total)

    @staticmethod
    def _calculate_percentiles(dataframe: pd.DataFrame, column: str) -> dict:
        median = dataframe[column].quantile(0.5)
        percentile_95 = dataframe[column].quantile(0.95)
        if median == percentile_95:
            percentile_95 = median + 100
        return {"median": median, "percentile_95": percentile_95}

    @classmethod
    def _data_preprocessing(cls, dataframe: pd.DataFrame) -> pd.DataFrame:
        # Keyed on observed_at only, so attributes of one reading never split over differing receive times
        index = ["entity_id", cls.OBSERVED_TIME_COL]
        pivoted_df = dataframe.pivot_table(index=index, columns="attr_name", values="value", aggfunc="first")
        pivoted_df.columns.name = None
        latency = dataframe.groupby(index)[cls.LATENCY_COL].first()
        return pivoted_df.join(latency).reset_index().drop(columns="entity_id")

    @staticmethod
    def detect_frequency(dataframe: pd.DataFrame, date_column: str) -> str:
        dataframe[date_column] = pd.to_datetime(dataframe[date_column])
        dataframe = dataframe.set_index(date_column)
        freq = pd.infer_freq(dataframe.index)
        if freq is None:
            deltas = dataframe.index.to_series().diff().dropna()
            detected_mode = deltas.mode()[0]
            freq = pd.to_timedelta(
                max(np.round(detected_mode.total_seconds()), 1), unit="s"
            ).to_pytimedelta()  # This is a Timedelta object

        return freq
