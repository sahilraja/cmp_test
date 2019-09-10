import * as request from "request-promise";

// Add Policies for Documents
export async function groupsAddPolicy(userId: string, docId: string, role: string) {
    try {
        let Options = {
            uri: `${process.env.GROUPS_URL}/document/user/add`,
            method: "POST",
            body: {
                userId: userId,
                docId: docId,
                role: role
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};
