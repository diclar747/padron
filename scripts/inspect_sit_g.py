import pandas as pd

file_path = "c:/Users/Sate Core i5/Downloads/SIT-G_Encarnacion_-telefonos_-_2026-04-27-10-10-19 formateado.xlsx"
try:
    df = pd.read_excel(file_path, nrows=5)
    print("Columns:")
    print(df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.to_string())
except Exception as e:
    print("Error:", e)
