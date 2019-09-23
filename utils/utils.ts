import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { AUTHENTICATE_MSG } from './error_msg';
import { userFindOne } from './users';
const SECRET: string = "CMP_SECRET";
const ACCESS_TOKEN_LIFETIME = '365d';
const ACCESS_TOKEN_FOR_URL = 24 * 60 * 60;
const SALTROUNDS = 10;

// User Authentication 
export async function authenticate(req: any, res: any, next: any) {
    try {
        if (!req.headers.authorization) throw new Error(AUTHENTICATE_MSG.MISSING_TOKEN)
        let bearerToken = req.headers.authorization.substring(7, req.headers.authorization.length)
        let token: any = await jwt_Verify(bearerToken)
        if (!token) throw new Error(AUTHENTICATE_MSG.INVALID_TOKEN)
        const user: any = await userFindOne("id", token.id);
        if (!user) {
            throw (new Error(AUTHENTICATE_MSG.INVALID_LOGIN));
        }
        if (!user.is_active) {
            throw new Error(AUTHENTICATE_MSG.USER_INACTIVE);
        }
        user.role = token.role;
        res.locals.user = user;
        return next();
    } catch (err) {
        console.log(err)
        next(err);
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


