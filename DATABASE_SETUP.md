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

3. Una vez creada, copia la **Internal Database URL** (o la External si necesitas acceso desde fuera de Render)

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

### 4. Para Desarrollo Local (Opcional)

Si quieres usar PostgreSQL también en desarrollo local:

1. Crea un archivo `.env` en la raíz del proyecto (no está en git)
2. Agrega:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/melo_loyalty_dev?schema=public"
   ```

O si prefieres seguir usando SQLite en desarrollo local, puedes crear un archivo `.env` con:

```
DATABASE_URL="file:./dev.sqlite"
```

Y cambiar temporalmente el `provider` en `prisma/schema.prisma` a `sqlite` cuando trabajes localmente.

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

