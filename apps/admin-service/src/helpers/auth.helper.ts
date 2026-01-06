/**
 * Helper para obtener información del usuario desde el token
 * Reutiliza la lógica del Auth Service
 */

import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { ForbiddenException } from '@nestjs/common';

/**
 * Obtiene información del usuario desde el token de Cognito
 */
export async function getUserFromToken(accessToken: string) {
  try {
    const credentials = loadCredentials();
    const cognitoClient = AWSClientFactory.createCognitoClient();

    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken,
    });

    const cognitoUser = await cognitoClient.send(getUserCommand);

    // Extraer email y otros atributos
    const emailAttribute = cognitoUser.UserAttributes?.find((attr) => attr.Name === 'email');
    const roleAttribute = cognitoUser.UserAttributes?.find((attr) => attr.Name === 'custom:role');
    
    const email = emailAttribute?.Value;
    const role = roleAttribute?.Value;

    if (!email) {
      throw new Error('No se pudo obtener el email del usuario desde el token. El token puede ser inválido o estar expirado.');
    }

    // Buscar userId en DynamoDB usando el email
    const dynamoClient = AWSClientFactory.createDynamoDBDocumentClient();
    
    const userResponse = await dynamoClient.send(
      new QueryCommand({
        TableName: credentials.dynamodb.usersTable,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
        Limit: 1,
      }),
    );

    const userId = userResponse.Items?.[0]?.userId || userResponse.Items?.[0]?.id;

    return {
      userId: userId || email, // Fallback a email si no hay userId
      email,
      role: role || 'user',
      username: cognitoUser.Username,
      attributes: cognitoUser.UserAttributes,
    };
  } catch (error: any) {
    if (error.message?.includes('Invalid token') || error.message?.includes('expired')) {
      throw new Error('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
    }
    throw new Error(`Error al obtener usuario del token: ${error.message || 'Error desconocido'}`);
  }
}

/**
 * Verifica que el usuario tenga rol de administrador
 */
export function requireAdmin(role: string | undefined): void {
  if (!role || !role.toString().startsWith('ADMIN')) {
    throw new ForbiddenException('Solo administradores pueden acceder a este endpoint');
  }
}

/**
 * Verifica que el usuario tenga un nivel específico de administrador
 */
export function requireAdminLevel(role: string | undefined, minLevel: number): void {
  requireAdmin(role);
  
  // Extraer nivel de admin (ej: ADMIN_LEVEL_1, ADMIN_LEVEL_2, ADMIN_LEVEL_3)
  const levelMatch = role?.match(/ADMIN_LEVEL_(\d+)/);
  const userLevel = levelMatch ? parseInt(levelMatch[1], 10) : 1;
  
  if (userLevel < minLevel) {
    throw new ForbiddenException(`Se requiere nivel de administrador ${minLevel} o superior`);
  }
}










