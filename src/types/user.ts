import {ObjectId} from "mongodb";

export interface User {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    createdAt?: Date;
    updatedAt?: Date;
    preferences?: Record<string, any>;
    trackingTopics: string[];
    clerkId?: string;
}

export interface UserMongoDbDocument extends Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
    _id: ObjectId;
    id: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface UserProfile {
    id: string;
    name?: string;
    email?: string;
    createdAt?: string;
    trackingTopics: string[];
    imageUrl?: string;
}

export interface UserStats {
    postsCount: number;
    commentsCount: number;
}