import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as request from "request-promise"
import { Users } from '../users/model';
const SECRET: string = "CMP_SECRET";
const ACCESS_TOKEN_LIFETIME = '365d';
const ACCESS_TOKEN_FOR_URL = 24 * 60 * 60;
const SALTROUNDS = 10;

// User Authentication 
export async function authenticate(req: any, res: any, next: any) {
    try {
        if (!req.headers.authorization) throw new Error("Missing token")
        let bearerToken = req.headers.authorization.substring(7, req.headers.authorization.length)
        let token: any = await jwt_Verify(bearerToken)
        if (!token) throw new Error("Invalid Token")
        res.locals.user = await Users.findById(token.id)
        res.locals.user.role = token.role
        return next();
    } catch (err) {
        console.log(err)
        res.send({ success: false, error: err.message });
    };
};

//  Hash password
export function hashPassword(password: any) {
    try {
        return bcrypt.hashSync(password, SALTROUNDS);
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Compare Password
export function comparePassword(password: any, hash_password: any) {
    try {
        return bcrypt.compareSync(password, hash_password)
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Create JWT life time
export async function jwt_create(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME });
};

//  Create JWT One Day
export async function jwt_for_url(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_FOR_URL });
};

//  JWT VERIFY
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
    };
};

