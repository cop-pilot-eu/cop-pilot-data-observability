import argparse
import os

import pandas as pd

from src.services.stats_service import StatsService


def convert_to_dataframe(filename: str) -> pd.DataFrame:
    # Check if the file exists before trying to read it
    if not os.path.exists(filename):
        print(f"Error: The file '{filename}' does not exist.")
        return None

    try:
        # Load the CSV into a DataFrame
        dataframe = pd.read_csv(filename)

        return dataframe

    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        return None


# Setup the argument parser
parser = argparse.ArgumentParser()
parser.add_argument("filename1", help="Path to the first CSV file")
parser.add_argument("filename2", help="Path to the second CSV file")


# Parse the arguments
args = parser.parse_args()

# Run the function
my_df = convert_to_dataframe(filename=args.filename1)
ref_df = convert_to_dataframe(filename=args.filename2)

result = StatsService.calculate_stats(current_df=my_df, reference_df=ref_df)
# run as: python calculate_stats.py ./inputs/dummy_context_data.csv ./inputs/dummy_reference_set.csv

print(f"Result: {result}")
