import {Bill} from "@/types/legislation";

export interface Post {
    _id: string;
    userId: string;
    username: string;
    userImage?: string;
    type: 'legislation' | 'bug_report';
    title: string;
    content: string;
    linkedBills?: Bill[];
    tags: string[];
    likes: string[]; // Array of user IDs who liked
    comments: Comment[];
    createdAt: string;
    updatedAt: string;
}


export interface Comment {
    _id: string;
    userId: string;
    username: string;
    userImage?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    replies?: Reply[];
    likes: string[]; // Array of user IDs who liked
}


export interface Reply {
    _id: string;
    userId: string;
    username: string;
    userImage?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    likes: string[]; // Array of user IDs who liked
}