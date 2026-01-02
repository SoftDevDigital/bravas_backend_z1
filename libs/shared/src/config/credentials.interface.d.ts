export interface Credentials {
    aws: {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        accountId: string;
    };
    cognito: {
        userPoolId: string;
        clientId: string;
        clientSecret: string;
    };
    dynamodb: {
        usersTable: string;
        userProfilesTable: string;
        userSessionsTable: string;
        contentTable: string;
        paymentsTable: string;
        subscriptionsTable: string;
        payoutsTable?: string;
        paymentDistributionsTable?: string;
        idempotencyTable?: string;
        paymentProofsTable: string;
        commissionsTable: string;
        messagesTable: string;
        verificationsTable: string;
        coursesTable: string;
        notificationsTable: string;
        analyticsEventsTable: string;
        userModelRelationsTable: string;
        modelAgencyRelationsTable: string;
        agencyAgencyRelationsTable: string;
    };
    s3: {
        avatarsBucket: string;
        contentBucket: string;
        verificationDocsBucket: string;
        paymentProofsBucket: string;
        coursesBucket: string;
    };
    eventbridge: {
        eventBusName: string;
    };
    sns: {
        userEventsTopic: string;
        paymentEventsTopic: string;
        contentEventsTopic: string;
        notificationEventsTopic: string;
    };
    ses: {
        fromEmail: string;
        region: string;
    };
    secrets: {
        jwtSecretArn: string;
        mercadopagoTokenArn: string;
        stripeSecretKeyArn: string;
    };
    payment: {
        mercadopago: {
            accessToken: string;
            publicKey: string;
        };
        stripe: {
            secretKey: string;
            publicKey: string;
            webhookSecret: string;
        };
    };
    api: {
        baseUrl: string;
        frontendUrl: string;
    };
}
