import json

import nannyml as nml
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
from scipy import stats


class DataObservability:
    CHUNK_NUMBER = 10
    BIN_SIZE = 10
    TIME_COL = "time"
    OBSERVED_TIME_COL = "observed_at"

    def __init__(self, data_source: pd.DataFrame, data_reference: pd.DataFrame) -> None:
        self.dataframe_analysis = self._data_preprocessing(data_source)
        self.dataframe_reference = self._data_preprocessing(data_reference)
        self.dataframe_analysis_source = data_source
        self.dataframe_reference_source = data_reference
        self.feature_names = [
            col for col in self.dataframe_reference.columns if col not in [self.TIME_COL, self.OBSERVED_TIME_COL]
        ]

    def get_data_quality_report(self) -> dict:
        """
        Get a detailed data quality report for the given time range.
        """
        df = self.dataframe_reference.copy()
        ref_freq = self.detect_frequency(df, self.OBSERVED_TIME_COL)
        # print(f"Detected frequency: {ref_freq}")
        dataframe_analysis_resampled = self._data_time_reindexing(
            self.dataframe_analysis, date_column=self.OBSERVED_TIME_COL, freq=ref_freq
        )
        dataframe_reference_resampled = self._data_time_reindexing(
            self.dataframe_reference, date_column=self.OBSERVED_TIME_COL, freq=ref_freq
        )
        ref_completeness, ref_avg_latency = self._calculate_reference_quality(
            dataframe_reference_resampled, self.feature_names, self.TIME_COL, self.OBSERVED_TIME_COL
        )
        return self._calculate_quality(
            dataframe_analysis_resampled,
            self.feature_names,
            self.TIME_COL,
            self.OBSERVED_TIME_COL,
            ref_completeness,
            ref_avg_latency,
        )

    @staticmethod
    def _data_time_reindexing(dataframe: pd.DataFrame, date_column: str, freq: str = "5min") -> pd.DataFrame:
        dataframe[date_column] = pd.to_datetime(dataframe[date_column])
        dataframe = dataframe.set_index(date_column)
        perfect_range = pd.date_range(start=dataframe.index.min(), end=dataframe.index.max(), freq=freq)
        dataframe = dataframe.reindex(perfect_range)
        dataframe.index.name = date_column
        return dataframe.reset_index()

    @staticmethod
    def _calculate_quality(
        dataframe: pd.DataFrame,
        feature_names: list,
        time_col1: str,
        time_col2: str,
        ref_completeness: float,
        ref_avg_latency: float,
    ) -> dict:
        missing_values = dataframe[feature_names].isna().sum().sum()
        completeness = 1 - (missing_values / (len(dataframe) * len(feature_names)))
        avg_latency_ms = (
            (np.abs(pd.to_datetime(dataframe[time_col1]) - pd.to_datetime(dataframe[time_col2])).dt.total_seconds() * 10**3)
            .mean()
            .astype(int)
        )
        completeness_diff_percentage = ((completeness - ref_completeness) / ref_completeness) * 100 if ref_completeness > 0 else 0
        avg_latency_diff_percentage = ((avg_latency_ms - ref_avg_latency) / ref_avg_latency) * 100 if ref_avg_latency > 0 else 0
        return {
            "number_of_attributes": len(feature_names),
            "number_of_records": len(dataframe),
            "total_missing_values": missing_values.item(),
            "completeness_%": round(completeness * 100, 2).item(),
            "avg_latency_ms": avg_latency_ms.item(),
            "completeness_diff_percentage": round(completeness_diff_percentage, 2).item(),
            "avg_latency_diff_percentage": round(avg_latency_diff_percentage, 2).item(),
        }

    @staticmethod
    def _calculate_reference_quality(dataframe: pd.DataFrame, feature_names: list, time_col1: str, time_col2: str) -> dict:
        missing_values = dataframe[feature_names].isna().sum().sum()
        completeness = 1 - (missing_values / (len(dataframe) * len(feature_names)))
        avg_latency_ms = (
            (np.abs(pd.to_datetime(dataframe[time_col1]) - pd.to_datetime(dataframe[time_col2])).dt.total_seconds() * 10**3)
            .mean()
            .astype(int)
        )
        print(f"Reference Completeness: {completeness}, Reference Avg Latency (ms): {avg_latency_ms}")
        return completeness, avg_latency_ms

    def get_attribute_quality_report(self) -> dict:
        """
        Get a detailed data quality report for the given dataset.
        """
        df = self.dataframe_analysis[self.feature_names].copy()
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
                "outliers": (np.abs(stats.zscore(dataframe[col])) > 3).sum().item()
                if is_numeric_dtype(dataframe[col])
                else "N/A",
            }
        return stats_dict

    def get_data_distribution_report(self) -> dict:
        columns_to_exclude = [self.OBSERVED_TIME_COL, self.TIME_COL]
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
        column_names = self.dataframe_reference.columns.to_list()
        column_names.remove(self.OBSERVED_TIME_COL)
        column_names.remove(self.TIME_COL)

        calc = nml.UnivariateDriftCalculator(
            column_names=column_names,
            timestamp_column_name=self.OBSERVED_TIME_COL,
            chunk_number=self.CHUNK_NUMBER,
            # chunk_period="W",
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
        return final_df.to_dict(orient="records"), drift_summary.to_dict(orient="records")

    def get_latency_report(self) -> tuple:
        datetime_columns = [self.OBSERVED_TIME_COL, self.TIME_COL]

        baseline_data_source = self.dataframe_reference_source.copy()
        baseline_data_source = self._convert_to_datetime(baseline_data_source, datetime_columns)
        baseline_data_source = self._calculate_latency(baseline_data_source, self.OBSERVED_TIME_COL, self.TIME_COL)

        baseline_statistics = self._calculate_percentiles(baseline_data_source, "latency")

        analysis_data_source = self.dataframe_analysis_source.copy()
        analysis_data_source = self._convert_to_datetime(analysis_data_source, datetime_columns)
        analysis_data_source = self._calculate_latency(analysis_data_source, self.OBSERVED_TIME_COL, self.TIME_COL)

        analysis_latency_distribution = self._calculate_data_distribution(
            dataframe=analysis_data_source, bin_size=5, columns_to_exclude=None, columns_to_include=["latency"]
        )
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

        return analysis_latency_distribution.to_dict(orient="records"), analysis_data_source.to_dict(orient="records")

    def get_multivariate_drift_report(self) -> dict:
        column_names = self.dataframe_reference.columns.to_list()
        column_names.remove(self.OBSERVED_TIME_COL)
        column_names.remove(self.TIME_COL)

        calc = nml.DataReconstructionDriftCalculator(
            column_names=column_names,
            timestamp_column_name=self.OBSERVED_TIME_COL,
            chunk_number=self.CHUNK_NUMBER,
            # chunk_period="W",
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
    def create_json_column(df: pd.DataFrame, column_list: list) -> pd.Series:
        return df[column_list].to_dict("records")

    @staticmethod
    def _convert_to_datetime(dataframe: pd.DataFrame, datetime_columns: list) -> pd.DataFrame:
        for col in datetime_columns:
            dataframe[col] = pd.to_datetime(dataframe[col], utc=True)
        return dataframe

    @staticmethod
    def _calculate_latency(dataframe: pd.DataFrame, datetime_column_a: str, datetime_column_b: str) -> pd.DataFrame:
        dataframe["latency"] = np.abs(dataframe[datetime_column_a] - dataframe[datetime_column_b]).dt.total_seconds() * 1000
        return dataframe

    @staticmethod
    def _calculate_percentiles(dataframe: pd.DataFrame, column: str) -> dict:
        median = dataframe[column].quantile(0.5)
        percentile_95 = dataframe[column].quantile(0.95)
        if median == percentile_95:
            percentile_95 = median + 100
        return {"median": median, "percentile_95": percentile_95}

    @staticmethod
    def _data_preprocessing(dataframe: pd.DataFrame) -> pd.DataFrame:
        pivoted_df = dataframe.pivot_table(
            index=["entity_id", "observed_at", "time"], columns="attr_name", values="value", aggfunc="first"
        ).reset_index()
        pivoted_df.columns.name = None
        return pivoted_df.drop(columns="entity_id")

    @staticmethod
    def detect_frequency(dataframe: pd.DataFrame, date_column: str) -> str:
        dataframe[date_column] = pd.to_datetime(dataframe[date_column])
        dataframe = dataframe.set_index(date_column)
        freq = pd.infer_freq(dataframe.index)
        if freq is None:
            deltas = dataframe.index.to_series().diff().dropna()
            detected_mode = deltas.mode()[0]
            freq = pd.to_timedelta(
                np.round(detected_mode.total_seconds() / 60) * 60, unit="s"
            ).to_pytimedelta()  # This is a Timedelta object

        return freq
