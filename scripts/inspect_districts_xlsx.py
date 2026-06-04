import pandas as pd

file_path = "c:/Users/Sate Core i5/Downloads/enc_limpio_expandido.xlsx"
df = pd.read_excel(file_path)
print("Total rows:", len(df))
print("Unique codigos:", df['codigo'].nunique())
print("Codigos list:", df['codigo'].unique()[:20].tolist())
print("First 10 rows:")
print(df.head(10))
