import { Credentials } from './credentials.interface';
export declare function loadCredentials(environment?: string): Credentials;
export declare function getCredentials(): Credentials;
export declare function getAWSCredentials(credentials?: Credentials): {
    region: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    };
};
export declare function getDynamoDBConfig(credentials?: Credentials): {
    region: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    };
    tables: {
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
};
export declare function getS3Config(credentials?: Credentials): {
    region: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    };
    buckets: {
        avatarsBucket: string;
        contentBucket: string;
        verificationDocsBucket: string;
        paymentProofsBucket: string;
        coursesBucket: string;
    };
};
