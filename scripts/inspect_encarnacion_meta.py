import pandas as pd

excel_path = "d:/Respaldo/numeros/padron encarnacion.xlsx"
print("Reading Excel file...")
df = pd.read_excel(excel_path)

print("Unique distritos in sheet:")
print(df['distrito'].unique())

print("\nUnique sections (codigo_sec):")
unique_sec = df['codigo_sec'].unique()
print("Count:", len(unique_sec))
print("Values:", sorted(unique_sec))

print("\nUnique local_vota (voting locales):")
unique_loc = df['local_vota'].unique()
print("Count:", len(unique_loc))
print("Values:", unique_loc)

print("\nChecking some rows with null or invalid values:")
print("Null codigo_sec:", df['codigo_sec'].isnull().sum())
print("Null local_vota:", df['local_vota'].isnull().sum())

# Sample of code_sec mapping to local_vota
print("\nSample mapping of codigo_sec to local_vota:")
mapping = df.groupby(['codigo_sec', 'local_vota']).size().reset_index(name='count')
print(mapping.to_string())
