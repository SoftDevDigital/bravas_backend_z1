/**
 * Mensajes de error estandarizados para el User Service
 * Asegura consistencia y claridad en todos los mensajes de error
 */

export const ErrorMessages = {
  // Autenticación
  AUTH: {
    UNAUTHORIZED: 'No estás autenticado. Por favor, inicia sesión.',
    TOKEN_INVALID: 'Token de autenticación inválido o expirado.',
    TOKEN_MISSING: 'Token de autenticación no proporcionado.',
    USER_NOT_FOUND: 'No se pudo obtener información del usuario desde el token.',
  },

  // Usuarios
  USER: {
    NOT_FOUND: 'Usuario no encontrado.',
    NOT_FOUND_BY_ID: (id: string) => `Usuario con ID ${id} no encontrado.`,
    ALREADY_EXISTS: 'El usuario ya existe.',
    UPDATE_FAILED: 'Error al actualizar el perfil del usuario.',
    DELETE_FAILED: 'Error al eliminar el usuario.',
    INVALID_ROLE: 'El rol del usuario no es válido.',
    PROFILE_NOT_FOUND: 'Perfil del usuario no encontrado.',
  },

  // Perfiles
  PROFILE: {
    NOT_FOUND: 'Perfil no encontrado.',
    UPDATE_FAILED: 'Error al actualizar el perfil.',
    NO_FIELDS_TO_UPDATE: 'No hay campos para actualizar. Proporciona al menos un campo válido.',
    INVALID_DATA: 'Los datos proporcionados no son válidos.',
  },

  // Modelos
  MODEL: {
    NOT_FOUND: 'Modelo no encontrado.',
    NOT_FOUND_BY_ID: (id: string) => `Modelo con ID ${id} no encontrado.`,
    NOT_A_MODEL: 'El usuario no es un modelo.',
    STATS_NOT_FOUND: 'No se encontraron estadísticas para este modelo.',
  },

  // Agencias
  AGENCY: {
    NOT_FOUND: 'Agencia no encontrada.',
    NOT_FOUND_BY_ID: (id: string) => `Agencia con ID ${id} no encontrada.`,
    NOT_AN_AGENCY: 'El usuario no es una agencia.',
  },

  // Permisos
  PERMISSIONS: {
    FORBIDDEN: 'No tienes permisos para realizar esta acción.',
    ADMIN_ONLY: 'Solo los administradores pueden realizar esta acción.',
    SUPER_ADMIN_ONLY: 'Solo los super administradores pueden realizar esta acción.',
    MODEL_ONLY: 'Solo los modelos pueden realizar esta acción.',
    AGENCY_ONLY: 'Solo las agencias pueden realizar esta acción.',
    SUPPORT_OR_ADMIN: 'Solo el personal de soporte o administradores pueden realizar esta acción.',
    OWNER_ONLY: 'Solo puedes realizar esta acción en tu propio perfil.',
  },

  // Avatar
  AVATAR: {
    FILE_REQUIRED: 'No se proporcionó ningún archivo. Por favor, selecciona una imagen.',
    FILE_TOO_LARGE: (maxSizeMB: number) => 
      `El archivo es demasiado grande. Tamaño máximo permitido: ${maxSizeMB}MB.`,
    INVALID_TYPE: (allowedTypes: string[]) => 
      `Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(', ')}.`,
    UPLOAD_FAILED: 'Error al subir el avatar. Por favor, intenta nuevamente.',
    DELETE_FAILED: 'Error al eliminar el avatar.',
    NOT_FOUND: 'Avatar no encontrado.',
    PROCESSING_FAILED: 'Error al procesar la imagen.',
  },

  // Verificación
  VERIFICATION: {
    NOT_FOUND: 'Verificación no encontrada.',
    PENDING_EXISTS: 'Ya tienes una verificación pendiente. Espera a que sea revisada antes de iniciar una nueva.',
    NOT_OWNER: 'No tienes permiso para acceder a esta verificación.',
    INCOMPLETE: 'Faltan archivos requeridos para completar la verificación.',
    INVALID_STATUS: (currentStatus: string) => 
      `La verificación no puede completarse. Estado actual: ${currentStatus}.`,
    INITIATE_FAILED: 'Error al iniciar el proceso de verificación.',
    COMPLETE_FAILED: 'Error al completar la verificación.',
    STATUS_FAILED: 'Error al obtener el estado de la verificación.',
  },

  // Relaciones
  RELATION: {
    ALREADY_EXISTS: 'Ya existe una relación entre estos usuarios.',
    NOT_FOUND: 'Relación no encontrada.',
    INVALID_TYPE: (type: string) => `Tipo de relación no válido: ${type}.`,
    CREATE_FAILED: 'Error al crear la relación.',
  },

  // Validación
  VALIDATION: {
    REQUIRED_FIELD: (field: string) => `El campo '${field}' es requerido.`,
    INVALID_FORMAT: (field: string) => `El formato del campo '${field}' no es válido.`,
    INVALID_VALUE: (field: string, value: any) => 
      `El valor '${value}' no es válido para el campo '${field}'.`,
    INVALID_DATE: 'La fecha proporcionada no es válida. Usa el formato ISO 8601 (YYYY-MM-DD).',
  },

  // Listados y búsquedas
  LIST: {
    INVALID_PAGE: 'El número de página debe ser mayor a 0.',
    INVALID_LIMIT: (maxLimit: number) => 
      `El límite de resultados debe estar entre 1 y ${maxLimit}.`,
    SEARCH_FAILED: 'Error al realizar la búsqueda.',
  },

  // Estadísticas
  STATS: {
    NOT_FOUND: 'No se encontraron estadísticas.',
    CALCULATION_FAILED: 'Error al calcular las estadísticas.',
  },

  // Pagos
  PAYMENT: {
    VERIFICATION_FAILED: 'Error al verificar el pago.',
    PROOF_ID_REQUIRED: 'El ID de comprobante de pago es requerido.',
    NOT_FOUND: 'Pago no encontrado.',
  },

  // General
  GENERAL: {
    INTERNAL_ERROR: 'Ocurrió un error interno. Por favor, intenta nuevamente más tarde.',
    BAD_REQUEST: 'La solicitud no es válida. Verifica los datos proporcionados.',
    NOT_IMPLEMENTED: 'Esta funcionalidad aún no está implementada.',
    SERVICE_UNAVAILABLE: 'El servicio no está disponible en este momento.',
  },
};

/**
 * Helper para crear mensajes de error consistentes
 */
export class ErrorMessageBuilder {
  static userNotFound(id?: string): string {
    return id ? ErrorMessages.USER.NOT_FOUND_BY_ID(id) : ErrorMessages.USER.NOT_FOUND;
  }

  static modelNotFound(id?: string): string {
    return id ? ErrorMessages.MODEL.NOT_FOUND_BY_ID(id) : ErrorMessages.MODEL.NOT_FOUND;
  }

  static agencyNotFound(id?: string): string {
    return id ? ErrorMessages.AGENCY.NOT_FOUND_BY_ID(id) : ErrorMessages.AGENCY.NOT_FOUND;
  }

  static fileTooLarge(maxSizeMB: number): string {
    return ErrorMessages.AVATAR.FILE_TOO_LARGE(maxSizeMB);
  }

  static invalidFileType(allowedTypes: string[]): string {
    return ErrorMessages.AVATAR.INVALID_TYPE(allowedTypes);
  }

  static requiredField(field: string): string {
    return ErrorMessages.VALIDATION.REQUIRED_FIELD(field);
  }

  static invalidLimit(maxLimit: number): string {
    return ErrorMessages.LIST.INVALID_LIMIT(maxLimit);
  }
}
























