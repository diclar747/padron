import pandas as pd

file_path = "c:/Users/Sate Core i5/Downloads/enc_limpio_expandido.xlsx"
try:
    df = pd.read_excel(file_path, nrows=5)
    print("Columns in enc_limpio_expandido.xlsx:")
    print(df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.to_string())
except Exception as e:
    print("Error:", e)
