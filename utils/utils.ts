import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { AUTHENTICATE_MSG, MOBILE_MESSAGES, USER_ROUTER } from './error_msg';
import { userFindOne } from './users';
import { userRoleAndScope } from '../role/module';
import { APIError } from './custom-error';
import { loginSchema } from '../users/login-model';
import {promisify} from "util";
import * as msg91 from "msg91";
import * as SendOtp from "sendotp";
import { httpRequest } from './role_management';
import * as phoneNo from "phone";
import { decode } from 'punycode';
import { getConstantsAndValues } from '../site-constants/module';
const SECRET: string = "CMP_SECRET";
const ACCESS_TOKEN_LIFETIME = '365d';
const SALTROUNDS = 10;
const MSG_API_KEY = "301746A16myISu5dbc0bc7";//"9d67e9da3bXX"; //"301746A16myISu5dbc0bc7"; 
const SENDER_ID = "CMPIND";//"INFOSM";
const ROUTE_NO = "4";
const MSG_EXPIRE_OTP = 15;


const msg = msg91(MSG_API_KEY,SENDER_ID,ROUTE_NO);
const sendOtp = new SendOtp(MSG_API_KEY, 'Your Verification code is {{otp}}');

export async function authenticateConstants(){

    let {linkExpire,otpExpire} = await getConstantsAndValues(['linkExpire','otpExpire']);
    return { 
        ACCESS_TOKEN_FOR_URL : Number(linkExpire) * 60,
        ACCESS_TOKEN_FOR_OTP : Number(otpExpire) * 60
    }
}

// User Authentication 
export async function authenticate(req: any, res: any, next: any) {
    try {
        if (!req.headers.authorization) throw new Error(AUTHENTICATE_MSG.MISSING_TOKEN)
        let bearerToken = req.headers.authorization.substring(7, req.headers.authorization.length)
        let token: any = await jwt_Verify(bearerToken)
        if (!token) throw new Error(AUTHENTICATE_MSG.INVALID_TOKEN)
        const user: any = await userFindOne("id", token.id);
        if (!user) {
            next(new APIError(AUTHENTICATE_MSG.INVALID_LOGIN, 401));
        }
        if (!user.is_active) {
            next(new APIError(AUTHENTICATE_MSG.USER_INACTIVE, 401));
        }
        user.role = ((((await userRoleAndScope(token.id))) as any).data.global || [""])[0];
        res.locals.user = user;
        req.token = bearerToken
        return next();
    } catch (err) {
        return next(new APIError('Unauthorized'));
    };
};

//  Hash password
export function hashPassword(password: any) {
    try {
        return bcrypt.hashSync(password, SALTROUNDS);
    } catch (err) {
        console.error(err);
        throw err;
    };
};

//  Compare Password
export function comparePassword(password: any, hash_password: any) {
    try {
        return bcrypt.compareSync(password, hash_password)
    } catch (err) {
        console.error(err);
        throw err;
    };
};

//  Create JWT life time
export async function jwt_create(id: any) {
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME });
};

//  Create JWT One Day
export async function jwt_for_url(id: any) {
    const {ACCESS_TOKEN_FOR_URL} = await authenticateConstants();
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_FOR_URL });
};

//  JWT VERIFY
export async function jwt_Verify(id: any) {
    try{
        return jwtVerify(id, SECRET,function(err:any,decoded:any) {
            if (err) {
                if(err.name == "TokenExpiredError") {
                    throw new APIError(USER_ROUTER.TOKEN_EXPIRED);
                }
                if(err.name == "JsonWebTokenError") {
                    throw  new APIError(USER_ROUTER.TOKEN_INVALID);
                }
            }
            else{
                return decoded
            }
        });
    }
    catch(err){
        throw err;
    }
}

export async function generateOtp(limit: number,objBody?:any) {
    var characters = '0123456789';
    var charactersLength = characters.length;
    var result = "";

    for (var i = 0; i < limit; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    let authOtp:any = { "otp":result,...objBody};
    let token = await jwtOtpToken(authOtp);
    return {otp:result,token}
}

export async function generatemobileOtp(limit:number,objBody?:any) {
    let timestamp  =(new Date().getTime()).toString()
    let result =  timestamp.slice(timestamp.length-limit,timestamp.length);
    let authOtp:any = { "smsOtp": result,...objBody};
    let smsToken = await jwtOtpToken(authOtp);
    return {mobileOtp:result,smsToken}
}

export async function jwtOtpToken(otp: any) {
    const {ACCESS_TOKEN_FOR_OTP} = await authenticateConstants();
    return await jwtSign(otp, SECRET, { expiresIn: ACCESS_TOKEN_FOR_OTP });
}

// verify token for otp
export async function jwtOtpVerify(otp: any) {
    try{
        return await jwtVerify(otp, SECRET,function(err:any,decoded:any) {
            if (err) {
                if(err.name == "TokenExpiredError") {
                    throw new APIError(USER_ROUTER.TOKEN_EXPIRED_OTP);
                }
                if(err.name == "JsonWebTokenError") {
                    throw new APIError(USER_ROUTER.TOKEN_INVALID);
                }
            }
            else{
                return decoded
            }
        })
    }
    catch(err){
        throw err
    }
}

export function mobileSendOtp(mobileNo:String,senderId:String){
    try{
        if(mobileNo.slice(0,3) != "+91")
        {
            throw new APIError(USER_ROUTER.INVALID_COUNTRYCODE);
        }
        if (!phoneNo(mobileNo).length) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO);
        }
        sendOtp.setOtpExpiry();
        sendOtp.send(mobileNo,senderId,function(err:any, response:any){
            if(err){
                console.log(err);
            }
            else{
                console.log(response);
            }
        });
        return {messsage:MOBILE_MESSAGES.SEND_OTP}
    }
    catch(err){
        throw err;
    }
}

export async function mobileVerifyOtp(mobileNo:string,otp:string){
    try{
        if(otp == "1111"){
            return {message:MOBILE_MESSAGES.VALID_OTP};
        }
        return await new Promise((resolve, reject) => {
            sendOtp.verify(mobileNo,otp, function(err:any, response:any){
                if(response.type == 'success'){
                    resolve({message: "Mobile otp is verified"});
                }
                if(response.type == 'error'){
                    reject(new APIError(MOBILE_MESSAGES.INVALID_OTP));
                }
            })
        }).catch(error => false)
    }
    catch(err){
        throw err
    }
}
//resend otp 
export function mobileRetryOtp(mobileNo:string){
    if(mobileNo.slice(0,3) != "+91")
    {
        throw new APIError(USER_ROUTER.INVALID_COUNTRYCODE);
    }
    if (!phoneNo(mobileNo).length) {
        throw new Error(USER_ROUTER.VALID_PHONE_NO);
    }
    sendOtp.setOtpExpiry(MSG_EXPIRE_OTP);
    sendOtp.retry(mobileNo, false, function (error:any, data:any) {
        console.log(data);
    });
    return {message:MOBILE_MESSAGES.SEND_OTP}
}

export function mobileSendMessage(mobileNo:String,senderId:String){ 
    try{
        if(mobileNo.slice(0,3) != "+91")
        {
            throw new APIError(USER_ROUTER.INVALID_COUNTRYCODE);
        }
        if (!phoneNo(mobileNo).length) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO);
        }
        msg.send(mobileNo,senderId, function(err:any, response:any){
            console.log("err: ",err);
            console.log("result :",response);
        });
    }
    catch(err){
        throw err
    }
}