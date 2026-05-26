# Padrón Electoral - Sistema de Control y Veedores (PWA)

Sistema web premium y PWA (Progressive Web App) diseñado para la coordinación, control electoral y veedores en tiempo real para distritos electorales.

## Características Principales

- **Panel de Control (Dashboard)**: Visualización de participación en tiempo real, gráficos interactivos con Chart.js, estadísticas generales y desglose por distritos o sectores.
- **Buscador de Electores**: Consulta rápida por Nombre o Cédula de Identidad de locales de votación, mesas y número de orden.
- **Semáforo de Mesas**: Monitoreo dinámico del porcentaje de participación por cada mesa electoral con alertas visuales de color (alta, media, baja).
- **Geolocalización Electoral**: Visualización territorial interactiva (Leaflet.js) con marcadores de locales y mapas de calor de participación.
- **Logística y Traslados**: Coordinación de móviles, choferes y traslados solicitados por electores con control de estado y consumo de combustible.
- **Reporte de Incidencias (Emergencias)**: Reporte y transmisión en tiempo real (vía SSE) de alertas críticas del centro de votación, incluyendo geolocalización, fotos y audio.
- **Panel de Administración**: Gestión completa de usuarios y veedores con asignación granular de permisos a nivel de módulos del sistema.
- **Gestión de Perfil**: Edición de datos personales, cambio de contraseña y carga de foto de perfil (avatar).
- **Modo Offline**: Funcionamiento sin conexión a internet mediante IndexedDB y Service Workers. Los datos se sincronizan automáticamente en segundo plano cuando se recupera la conexión.
- **Escaneo OCR y QR**: Captura automática de nombres y números de cédula con cámara móvil (Tesseract.js) y firma de acreditaciones mediante QR.

## Tecnologías Utilizadas

- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (via CDN), Leaflet, Chart.js, Tesseract.js, jsPDF.
- **Backend**: Node.js, Express, MySQL (mysql2), JSON Web Tokens (JWT), Multer, BcryptJS.
- **Despliegue**: Optimizado para Serverless en Vercel.

## Instalación y Desarrollo Local

1. Clonar el repositorio.
2. Crear un archivo `.env` en la raíz con la configuración de la base de datos:
   ```env
   PORT=4000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=tu_contraseña
   DB_NAME=padron_electoral
   DB_PORT=3306
   JWT_SECRET=tu_clave_secreta
   ```
3. Instalar las dependencias:
   ```bash
   npm install
   ```
4. Crear la base de datos ejecutando el script de esquema:
   ```bash
   # Importar el esquema y las semillas en MySQL
   mysql -u root -p padron_electoral < database/schema.sql
   mysql -u root -p padron_electoral < database/seed.sql
   ```
5. Iniciar el servidor local:
   ```bash
   npm run dev
   ```
