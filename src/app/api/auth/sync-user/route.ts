import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { syncUserToMongoDB } from "@/lib/clerkMongoIntegration";

// This endpoint will run on the server and handles syncing the current user to MongoDB
export async function GET(req: NextRequest) {
  try {
    // Try to get user ID from auth()
    const { userId } = auth();

    // If that fails, try to get the current user directly
    if (!userId) {
      const user = await currentUser();

      if (!user) {
        console.error("User not authenticated");
        return NextResponse.json(
          { success: false, error: "Not authenticated" },
          { status: 401 }
        );
      }

      // Use the user object directly
      await syncUserToMongoDB(user);

      return NextResponse.json({
        success: true,
        message: "User synchronized with MongoDB using currentUser()",
        userId: user.id
      });
    }

    // If userId exists, proceed with original implementation
    console.log("User authenticated with ID:", userId);

    // Fetch user data from Clerk
    const clerkUserResponse = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!clerkUserResponse.ok) {
      console.error("Failed to fetch user data from Clerk API:", clerkUserResponse.status);
      return NextResponse.json(
        { success: false, error: "Failed to fetch user data from Clerk" },
        { status: 500 }
      );
    }

    const clerkUser = await clerkUserResponse.json();

    // Sync user to MongoDB
    await syncUserToMongoDB(clerkUser);

    return NextResponse.json({
      success: true,
      message: "User synchronized with MongoDB",
      userId
    });

  } catch (error) {
    console.error("Error syncing user to MongoDB:", error);
    return NextResponse.json(
      { success: false, error: String(error) || "Internal server error" },
      { status: 500 }
    );
  }
}
