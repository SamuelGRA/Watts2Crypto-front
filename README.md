# Watts2Crypto-front

Watts2Crypto-front es el frontend de Watts2Crypto, una aplicación para estimar la rentabilidad de minería de criptomonedas a partir de hardware, software, pools, electricidad y cotizaciones de monedas.

> Esta aplicación se ha desarrollado como parte de un TFG (Trabajo de Fin de Grado) y no genera ningún tipo de retribución económica. El proyecto se usa con fines académicos y personales, no comerciales.

## Repositorio relacionado

Este repositorio debe usarse junto con el backend, si se pretende desplegar la app localmente:

- [Watts2Crypto-back](../watts2crypto-back)

Lo más cómodo es tener ambos repositorios en una misma carpeta padre:

```text
watts2crypto/
├─ watts2crypto-back/
└─ Watts2Crypto-front/
```

## Qué hace la aplicación

La interfaz permite navegar por:

- Calculadora de rentabilidad.
- Datos de rentabilidad de hardware (hahsrate, consumo),
- Datos de rentabilidad de software minero (monedas soportadas, comisiones).
- Datos de costes eléctricos por zonas y evolución histórica.
- Datos de cotizaciones de monedas tradicionales y evolución histórica.
- Datos de precios de criptomonedas y evolución histórica.
- Datos de pools de minería (monedas soportadas, comisiones).
- Una pequeña guía de uso.

El frontend consume la API del backend y muestra la información de forma interactiva para comparar escenarios de minería.

## Formas de uso

### 1. Despliegue en Vercel

El frontend está desplegado en Vercel, este es el punto de acceso a la app, accesible a través del siguiente enlace: https://watts2crypto.vercel.app

### 2. Uso con Docker

El frontend también puede servirse desde la imagen Docker incluida en el proyecto, junto al backend mediante `docker compose` desde el repositorio del backend. Los detalles de uso con Dokcer están indicados en el [reposiotrio del backend](#repositorio-relacionado).

## Despliegue local con Docker Compose

Si levantas el proyecto completo desde el backend:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`

Cuando cambies datos en la base de datos importando una snapshot, se recomienda reiniciar el entorno completo:

```bash
docker compose restart
```

## Licencia y uso

Este proyecto se ha desarrollado con fines académicos como parte de un Trabajo de Fin de Grado (TFG).

Todos los derechos están reservados. Queda prohibida la redistribución, modificación o explotación comercial del código fuente.

Para más información, consulte el archivo LICENSE.
