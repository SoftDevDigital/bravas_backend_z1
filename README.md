# 🚀 BRAVAS Backend - Serverless Architecture

Backend completo de la plataforma BRAVAS construido con arquitectura serverless pura usando AWS Lambda, NestJS y Terraform.

## 📋 Características

- ✅ **Arquitectura Serverless Pura** - Cada servicio es una Lambda function
- ✅ **Sin Docker** - Desarrollo y deployment directo a AWS
- ✅ **Credenciales Centralizadas** - Sistema de credenciales separado y fácil de cambiar
- ✅ **Terraform IaC** - Infraestructura como código desde el inicio
- ✅ **Microservicios** - Servicios independientes y escalables
- ✅ **NestJS CLI** - Todos los componentes creados con CLI

## 🏗️ Arquitectura

```
API Gateway
    │
    ├─── Auth Service (Lambda)
    ├─── User Service (Lambda)
    ├─── Content Service (Lambda)
    ├─── Payment Service (Lambda)
    ├─── Admin Service (Lambda)
    ├─── Notification Service (Lambda)
    ├─── Analytics Service (Lambda)
    └─── Courses Service (Lambda)
            │
    ┌───────┴───────┐
    │               │
DynamoDB          S3
EventBridge       Cognito
SNS/SES           Secrets Manager
```

## 🛠️ Stack Tecnológico

- **Framework**: NestJS 11.0.1
- **Runtime**: Node.js 18.x (AWS Lambda)
- **Lenguaje**: TypeScript 5.7.3
- **Infrastructure**: Terraform
- **Serverless**: Serverless Framework
- **Database**: AWS DynamoDB
- **Storage**: AWS S3
- **Auth**: AWS Cognito
- **Events**: AWS EventBridge
- **Messaging**: AWS SNS/SES

## 📁 Estructura del Proyecto

```
BRAVAS_BACKEND_Z1/
├── apps/                    # Microservicios (se crearán con NestJS CLI)
│   ├── auth-service/
│   ├── user-service/
│   ├── content-service/
│   ├── payment-service/
│   ├── admin-service/
│   ├── notification-service/
│   ├── analytics-service/
│   └── courses-service/
├── libs/                    # Librerías compartidas
│   └── shared/             # ✅ Creado - Sistema de credenciales
├── config/                  # Configuración
│   └── credentials/         # ✅ Creado - Credenciales por ambiente
├── terraform/               # Infrastructure as Code
│   ├── modules/
│   └── environments/
├── scripts/                 # Scripts de utilidad
└── docs/                    # Documentación
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- Yarn 1.22+
- AWS CLI configurado
- Terraform 1.6+
- Serverless Framework
- NestJS CLI (`npm install -g @nestjs/cli`)

### Instalación

```bash
# Instalar dependencias
yarn install

# Construir libs compartidas
yarn build:shared

# Configurar credenciales
cp config/credentials/credentials.example.json config/credentials/credentials.dev.json
# Editar config/credentials/credentials.dev.json con tus credenciales
```

### Uso del Sistema de Credenciales

```typescript
import { loadCredentials, getAWSCredentials } from '@bravas/shared/config';

// Cargar credenciales
const credentials = loadCredentials('dev'); // o 'staging', 'prod'

// Usar helpers
const awsConfig = getAWSCredentials();
```

## 📝 Estado del Proyecto

### ✅ Completado (Fase 1 - Setup Base)

- [x] Proyecto base creado con NestJS CLI
- [x] Configurado como monorepo
- [x] Sistema de credenciales centralizado
- [x] `libs/shared` creado con sistema de credenciales
- [x] TypeScript configurado con paths
- [x] Yarn workspaces configurado
- [x] `.gitignore` configurado

### 🚧 Próximos Pasos

- [ ] Configurar Terraform base
- [ ] Configurar Serverless Framework base
- [ ] Crear infraestructura AWS (Fase 2)
- [ ] Crear Auth Service (Fase 3)

## 🔐 Seguridad

- Credenciales centralizadas en `config/credentials/`
- Archivos de credenciales NO se commitean
- Uso de AWS Secrets Manager para producción
- IAM roles con permisos mínimos necesarios

## 📞 Documentación

- [Sistema de Credenciales](./config/credentials/README.md)
- [Plan de Implementación](./PLAN-IMPLEMENTACION.md) (por crear)

---

**Versión**: 0.0.1  
**Última actualización**: 2024
