# Configuración de Base de Datos

## Estado Actual

Tu aplicación ahora está configurada para usar **PostgreSQL** en lugar de SQLite, lo cual es mucho mejor para producción.

## Pasos para Configurar

### 1. Configurar PostgreSQL en Render

1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Crea un nuevo **PostgreSQL Database**:
   - Click en "New +" → "PostgreSQL"
   - Elige un nombre (ej: `melo-loyalty-db`)
   - Selecciona el plan (el plan gratuito funciona bien para empezar)
   - Selecciona la misma región que tu aplicación
   - Click en "Create Database"

3. Una vez creada, copia la **Internal Database URL** para usar en producción (dentro de Render)
   - **Internal Database URL**: Para usar en tu aplicación desplegada en Render (más rápido y seguro)
   - **External Database URL**: Para usar desde tu máquina local o herramientas externas

### 2. Configurar Variable de Entorno en Render

1. Ve a tu servicio de aplicación en Render
2. Ve a "Environment" en el menú lateral
3. Agrega una nueva variable:
   - **Key**: `DATABASE_URL`
   - **Value**: La URL de PostgreSQL que copiaste (formato: `postgresql://user:password@host:port/database?schema=public`)
4. Guarda los cambios

### 3. Ejecutar Migraciones

Las migraciones se ejecutarán automáticamente cuando Render despliegue tu aplicación porque el script `setup` en `package.json` incluye `prisma migrate deploy`.

Si necesitas ejecutarlas manualmente:

```bash
# En Render, en el shell de tu servicio:
npm run setup
```

O directamente:

```bash
npx prisma migrate deploy
```

### 4. Para Desarrollo Local

Tienes dos opciones para desarrollo local:

#### Opción A: Usar la Base de Datos de Render (Recomendado para pruebas)

Para probar con la misma base de datos de producción:

1. Ve a tu base de datos PostgreSQL en Render
2. En la sección "Connections", copia la **External Database URL** (NO la Internal)
   - La Internal solo funciona dentro de la red de Render
   - La External permite conexiones desde fuera de Render (tu máquina local)
3. Crea un archivo `.env` en la raíz del proyecto (no está en git)
4. Agrega:
   ```
   DATABASE_URL="postgresql://user:password@external-host:5432/database?schema=public"
   ```
   (Reemplaza con la External Database URL que copiaste)

**Nota de Seguridad**: Si usas la base de datos de producción para desarrollo, ten cuidado con los cambios que hagas. Considera crear una base de datos separada para desarrollo.

#### Opción B: PostgreSQL Local

Si prefieres una base de datos PostgreSQL local:

1. Instala PostgreSQL en tu máquina local
2. Crea una base de datos:
   ```bash
   createdb melo_loyalty_dev
   ```
3. Crea un archivo `.env` con:
   ```
   DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/melo_loyalty_dev?schema=public"
   ```

#### Opción C: SQLite para Desarrollo Local (Más Simple)

Si prefieres seguir usando SQLite en desarrollo local:

1. Crea un archivo `.env` con:
   ```
   DATABASE_URL="file:./dev.sqlite"
   ```
2. Cambia temporalmente el `provider` en `prisma/schema.prisma` a `sqlite` cuando trabajes localmente
3. Recuerda cambiar de vuelta a `postgresql` antes de hacer commit

## Verificar que Funciona

1. Despliega tu aplicación en Render
2. Verifica los logs para asegurarte de que las migraciones se ejecutaron correctamente
3. Accede a tu app desde el admin de Shopify
4. Verifica que la sesión se guarda correctamente

## Migración de Datos (Si ya tienes datos en SQLite)

Si ya tienes datos importantes en SQLite y quieres migrarlos a PostgreSQL:

1. Exporta los datos de SQLite:
   ```bash
   sqlite3 prisma/dev.sqlite .dump > backup.sql
   ```

2. Conecta a tu base de datos PostgreSQL y ejecuta el dump (ajustando los tipos de datos según sea necesario)

**Nota**: Para sesiones de Shopify, generalmente es más fácil simplemente re-autenticar la app después de migrar, ya que las sesiones se recrean automáticamente.

## Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"

- Asegúrate de que la variable `DATABASE_URL` está configurada en Render
- Verifica que el formato de la URL es correcto

### Error: "Connection refused" o "Timeout"

- Verifica que la base de datos PostgreSQL está corriendo en Render
- Asegúrate de usar la **Internal Database URL** si tu app está en la misma región
- Verifica que el firewall de Render permite conexiones entre tu app y la base de datos

### Error: "Table does not exist"

- Ejecuta las migraciones: `npm run setup` o `npx prisma migrate deploy`
- Verifica que las migraciones se ejecutaron correctamente en los logs

## Ventajas de PostgreSQL sobre SQLite

✅ **Persistencia**: Los datos persisten entre reinicios del contenedor  
✅ **Escalabilidad**: Funciona con múltiples instancias de tu app  
✅ **Confiabilidad**: Base de datos robusta y probada en producción  
✅ **Backups**: Render ofrece backups automáticos  
✅ **Rendimiento**: Mejor para aplicaciones con múltiples usuarios

