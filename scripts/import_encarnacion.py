import pandas as pd
import pymysql
import numpy as np

# Configuración de base de datos
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = ""
DB_NAME = "padron_electoral"
DB_PORT = 3306

def main():
    print("--- Iniciando Importación de Electores de Encarnación ---")
    
    # 1. Conectar a MySQL
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=True
    )
    cursor = conn.cursor()
    print("Conectado a MySQL local.")

    # 2. Asegurar Secciones (seccio) y Locales (secc_local) de Encarnación
    # Secciones
    secciones = [
        (165, 7, "ITAPUA", 1, "ENCARNACION", 0, "CENTRO REGIONAL PATRICIO ESCOB", "165 - CENTRO REGIONAL PATRICIO ESCOB", "CENTRO REGIONAL", "CENTRO REGIONAL PATRICIO ESCOB"),
        (342, 7, "ITAPUA", 1, "ENCARNACION", 0, "ESC. J.F. KENNEDY", "342 - ESC. J.F. KENNEDY", "BARRIO KENNEDY", "ESC. J.F. KENNEDY"),
        (343, 7, "ITAPUA", 1, "ENCARNACION", 0, "ESC. CUATRO POTRERO", "343 - ESC. CUATRO POTRERO", "CUATRO POTRERO", "ESC. CUATRO POTRERO")
    ]
    
    print("Registrando secciones de Encarnación...")
    for sec in secciones:
        cursor.execute("""
            INSERT INTO seccio (codigo_sec, codigo_dep, ndepart, codigo_dis, ndistrito, zona, descripcio, w_seccio, direccion, local_vota)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE ndistrito=VALUES(ndistrito)
        """, (sec[0], sec[1], sec[2], sec[3], sec[4], sec[5], sec[6], sec[7], sec[8], sec[9]))

    # Locales
    locales = [
        (1651, 7, 1, 165, 1, 1, "CENTRO REGIONAL PATRICIO ESCOBAR", "CENTRO REGIONAL", "", 1651),
        (3421, 7, 1, 342, 1, 1, "ESC. J.F. KENNEDY", "BARRIO KENNEDY", "", 3421),
        (3431, 7, 1, 343, 1, 1, "ESC. CUATRO POTRERO", "CUATRO POTRERO", "", 3431)
    ]
    
    print("Registrando locales de votación de Encarnación...")
    for loc in locales:
        cursor.execute("""
            INSERT INTO secc_local (id, codigo_dep, codigo_dis, codigo_sec, codigo_loc, cod_local, nombre_loc, direccion, recibido, secc_loc)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE nombre_loc=VALUES(nombre_loc)
        """, loc)

    # 3. Leer los archivos Excel
    print("Cargando padron encarnacion.xlsx (metadatos)...")
    df_meta = pd.read_excel("d:/Respaldo/numeros/padron encarnacion.xlsx")
    print(f"- Metadatos cargados: {len(df_meta)} filas.")

    print("Cargando enc_limpio_expandido.xlsx (teléfonos)...")
    df_tel = pd.read_excel("c:/Users/Sate Core i5/Downloads/enc_limpio_expandido.xlsx")
    print(f"- Teléfonos cargados: {len(df_tel)} filas.")

    # 4. Cruzar los datos para obtener metadatos de los electores con teléfonos
    print("Cruzando datos de teléfonos y metadatos...")
    
    # Seleccionar columnas clave de metadatos para el merge
    meta_cols = ['codigo', 'apellido', 'direccion', 'codigo_sec', 'local_vota']
    df_meta_subset = df_meta[meta_cols].copy()
    
    # Hacer el merge utilizando la columna 'codigo'
    df_merged = pd.merge(df_tel, df_meta_subset, on='codigo', how='left')
    print(f"- Filas unidas: {len(df_merged)}")

    # Tratar valores nulos y asignar valores por defecto
    df_merged['apellido'] = df_merged['apellido'].fillna('')
    df_merged['direccion'] = df_merged['direccion'].fillna('ENCARNACION')
    df_merged['codigo_sec'] = df_merged['codigo_sec'].fillna(165).astype(int)
    
    # Asegurar que el código de sección sea válido
    valid_sec_codes = {165, 342, 343}
    df_merged['codigo_sec'] = df_merged['codigo_sec'].apply(lambda x: x if x in valid_sec_codes else 165)
    
    # Mapear sec_loc en base al codigo_sec
    sec_to_loc = {165: 1651, 342: 3421, 343: 3431}
    df_merged['sec_loc'] = df_merged['codigo_sec'].map(sec_to_loc)

    # 5. Ordenar alfabéticamente para la división de mesas
    print("Ordenando electores alfabéticamente por sección, apellido y nombre...")
    df_merged = df_merged.sort_values(by=['codigo_sec', 'apellido', 'nombre']).reset_index(drop=True)

    # 6. Asignar mesas y orden de votación
    print("Asignando números de mesa y orden (grupos de 350 por local)...")
    # cumcount nos da el índice correlativo dentro de cada grupo 'codigo_sec'
    cum_counts = df_merged.groupby('codigo_sec').cumcount()
    df_merged['mesa'] = (cum_counts // 350) + 1
    df_merged['orden'] = (cum_counts % 350) + 1

    # Reemplazar NaNs por None para que se guarden como NULL en SQL
    df_merged = df_merged.replace({np.nan: None})

    # 7. Insertar en MySQL local (mas_pda) en lotes
    print("Insertando electores de Encarnación en MySQL local...")
    
    # Opcional: limpiar registros existentes de Encarnación para evitar duplicados si se re-ejecuta
    print("Limpiando registros antiguos de Encarnación...")
    cursor.execute("DELETE FROM mas_pda WHERE codigo_sec IN (165, 342, 343)")
    
    sql_insert = """
        INSERT INTO mas_pda (nombre, apellido, numero_ced, direccion, codigo_sec, mesa, sec_loc, telefono, votado, orden)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    batch_size = 2000
    records = []
    total_inserted = 0

    for i, row in df_merged.iterrows():
        # Split simple para separar nombre y apellido si es necesario (el Excel expandido solo tiene 'nombre' completo)
        full_name = str(row['nombre']).strip()
        apellido = str(row['apellido']).strip()
        
        # Si el apellido está vacío en los metadatos, intentamos extraer heurísticamente del nombre
        if not apellido:
            parts = full_name.split(' ')
            first_name = parts[0]
            apellido = " ".join(parts[1:])
        else:
            first_name = full_name
            
        cedula = str(row['cedula']).strip().split('.')[0] # limpiar decimales si los hay
        direccion = row['direccion']
        codigo_sec = int(row['codigo_sec'])
        mesa = int(row['mesa'])
        sec_loc = int(row['sec_loc'])
        telefono = str(row['celular']).strip().split('.')[0] if row['celular'] else None
        
        # Asegurar formato correcto de celular (ej. agregar '0' inicial si falta)
        if telefono and not telefono.startswith('0'):
            telefono = '0' + telefono

        records.append((
            first_name,
            apellido,
            cedula,
            direccion,
            codigo_sec,
            mesa,
            sec_loc,
            telefono,
            0, # votado por defecto es 0 (no votó)
            int(row['orden'])
        ))

        if len(records) >= batch_size:
            cursor.executemany(sql_insert, records)
            total_inserted += len(records)
            print(f"- Insertados {total_inserted} registros...")
            records = []

    # Insertar el último lote restante
    if records:
        cursor.executemany(sql_insert, records)
        total_inserted += len(records)
        print(f"- Insertados {total_inserted} registros en total.")

    cursor.close()
    conn.close()
    print("--- Importación Finalizada con Éxito ---")

if __name__ == "__main__":
    main()
