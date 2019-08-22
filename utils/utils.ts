const SECRET: string = "CMP_SECRET";
const ACCESS_TOKEN_LIFETIME = '365d';
const ACCESS_TOKEN_FOR_URL = 30 * 60;
import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as request from "request";
const SALTROUNDS = 10;

export function hash_password(password: any) {
    try {
        return bcrypt.hashSync(password, SALTROUNDS);
    } catch (err) {
        console.log(err);
        throw err;
    };
}; // hash the password

export function compare_password(password: any, hash_password: any) {
    try {
        return bcrypt.compareSync(password, hash_password)
    } catch (err) {
        console.log(err);
        throw err;
    };
}; // comapre password and hash password

export async function jwt_create(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME });
}; // create jwt token

export async function jwt_for_url(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_FOR_URL });
}; // create jwt token for url

export async function jwt_Verify(id: any) {
    return await jwtVerify(id, SECRET);
}; // verify jwt token

export async function requestApi(options: any) {
    return new Promise((resolve, reject) => {
        request(options, function (err: any, response: any, body: any) {
            if (err) {
                reject(err);
            }
            resolve(body);
        });
    })
}
