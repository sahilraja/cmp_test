import { Users } from "./model";

export interface User {
    name: string;
    id : string | number;
    role : string;
}

const users : Array<User> = [
    { name: "Admin", id : 1, role: "admin"},
    { name: "Moderator", id : 2, role: "user"}
]
export async function list() : Promise<Array<any>> {
    return await Users.find().exec();
}

// Uncomment the following to make sure there is atleast one user with admin role.
// list().then(users => {
//     if (users.length == 0) {
//         Users.create({ firstName: "Admin", lastName: "", role : "admin"}).then(user => console.log("Admin created successfully", user));
//     }
// })