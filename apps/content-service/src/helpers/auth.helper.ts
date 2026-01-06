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















