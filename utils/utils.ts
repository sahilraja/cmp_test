const SECRET: string = "CMP_SECRET";
const ACCESS_TOKEN_LIFETIME = '365d';
const ACCESS_TOKEN_FOR_URL = 30 * 60;
import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as request from "request-promise"
const SALTROUNDS = 10;

export function hash_password(password: any) {
    try {
        return bcrypt.hashSync(password, SALTROUNDS);
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export function compare_password(password: any, hash_password: any) {
    try {
        return bcrypt.compareSync(password, hash_password)
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function jwt_create(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME });
};

export async function jwt_for_url(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_FOR_URL });
};

export async function jwt_Verify(id: any) {
    return await jwtVerify(id, SECRET);
};

//  check capabilities
export async function checkCapability(object: any) {
    try {
        const { role, scope, capability } = object
        let Options = {
            uri: `${process.env.RBAC_URL}/capabilities/check`,
            method: "GET",
            qs: {
                role: role,
                scope: scope,
                capability: capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        console.log(err);
        throw err;
    }
}

