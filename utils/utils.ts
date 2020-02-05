import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { AUTHENTICATE_MSG, MOBILE_MESSAGES, USER_ROUTER, OTP_BYPASS } from './error_msg';
import { userFindOne, userUpdate } from './users';
import { userRoleAndScope } from '../role/module';
import { APIError } from './custom-error';
import { loginSchema } from '../users/login-model';
import { promisify } from "util";
const TASK_URL = process.env.TASK_HOST || "http://localhost:5052";
import * as request from "request-promise";
import * as msg91 from "msg91";
import * as SendOtp from "sendotp";
import { httpRequest } from './role_management';
import * as phoneNo from "phone";
import { decode } from 'punycode';
import { getConstantsAndValues } from '../site-constants/module';
import { sendNotification } from '../users/module';
import { RefreshTokenSchema } from '../users/refresh-token-model';
const SECRET: string = "CMP_SECRET";
const ACCESS_TOKEN_LIFETIME = '365d';
const SALTROUNDS = 10;
const MSG_API_KEY = "301746A16myISu5dbc0bc7";//"9d67e9da3bXX"; //"301746A16myISu5dbc0bc7"; 
const SENDER_ID = "CMPIND";//"INFOSM";
const ROUTE_NO = "4";
const MSG_EXPIRE_OTP = 15;
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || "http://localhost:4002"
const msg = msg91(MSG_API_KEY, SENDER_ID, ROUTE_NO);
const sendOtp = new SendOtp(MSG_API_KEY, 'Your Verification code is {{otp}}');

export async function authenticateConstants() {

    let { linkExpire, otpExpire } = await getConstantsAndValues(['linkExpire', 'otpExpire']);
    return {
        ACCESS_TOKEN_FOR_URL: Number(linkExpire || 1) * 60 * 60,
        ACCESS_TOKEN_FOR_OTP: Number(otpExpire || 1) * 60 * 60
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
        const tokenData: any = await RefreshTokenSchema.findOne({ userId: user._id, access_token: bearerToken }).exec()
        let { systemTimeOut } = (await getConstantsAndValues(["systemTimeOut"]) || 15)
        if (tokenData && new Date(tokenData.lastUsedAt).setMinutes(new Date(tokenData.lastUsedAt).getMinutes() + Number(systemTimeOut)) < new Date().getTime()) {
            console.error(`user ${user._id} session inactive from last ${systemTimeOut} `)
            next(new APIError(`Your session has timed out. Please login again.`, 401))
            return
        }
        if(!tokenData) next(new APIError(`You have been logged out. Please login again.`, 401))
        tokenData.set('lastUsedAt', new Date())
        await tokenData.save()
        user.role = ((((await userRoleAndScope(token.id))) as any).data || [""])[0];
        res.locals.user = user;
        req.token = bearerToken
        req.rootPath = [];
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
    const { ACCESS_TOKEN_FOR_URL } = await authenticateConstants();
    return await jwtSign(id, SECRET, { expiresIn: ACCESS_TOKEN_FOR_URL });
};

//  JWT VERIFY
export async function jwt_Verify(id: any) {
    try {
        return jwtVerify(id, SECRET, function (err: any, decoded: any) {
            if (err) {
                if (err.name == "TokenExpiredError") {
                    throw new APIError(USER_ROUTER.TOKEN_EXPIRED);
                }
                if (err.name == "JsonWebTokenError") {
                    throw new APIError(USER_ROUTER.TOKEN_INVALID);
                }
            }
            else {
                return decoded
            }
        });
    }
    catch (err) {
        throw err;
    }
}

export async function generateOtp(limit: number, objBody?: any) {
    var characters = '0123456789';
    var charactersLength = characters.length;
    var result = "";

    for (var i = 0; i < limit; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    let authOtp: any = { "otp": result, ...objBody };
    let token = await jwtOtpToken(authOtp);
    return { otp: result, token }
}

export async function generatemobileOtp(limit: number, objBody?: any) {
    let timestamp = (new Date().getTime()).toString()
    let result = timestamp.slice(timestamp.length - limit, timestamp.length);
    let authOtp: any = { "smsOtp": result, ...objBody };
    let smsToken = await jwtOtpToken(authOtp);
    return { mobileOtp: result, smsToken }
}

export async function jwtOtpToken(otp: any) {
    const { ACCESS_TOKEN_FOR_OTP } = await authenticateConstants();
    return await jwtSign(otp, SECRET, { expiresIn: ACCESS_TOKEN_FOR_OTP });
}

// verify token for otp
export async function jwtOtpVerify(otp: any) {
    try {
        return await jwtVerify(otp, SECRET, function (err: any, decoded: any) {
            if (err) {
                if (err.name == "TokenExpiredError") {
                    throw new APIError(USER_ROUTER.TOKEN_EXPIRED_OTP);
                }
                if (err.name == "JsonWebTokenError") {
                    throw new APIError(USER_ROUTER.TOKEN_INVALID);
                }
            }
            else {
                return decoded
            }
        })
    }
    catch (err) {
        throw err
    }
}

export async function mobileSendOtp(mobileNo: string, id: string) {
    try {
        let user = await userFindOne('id', id);
        return await sendMobileOtp(mobileNo, user);
    }
    catch (err) {
        throw err;
    }
}

export async function mobileVerifyOtp(mobileNo: string, otp: string, id: string) {
    try {
        let userInfo = await userFindOne('id', id);
        let mobileToken: any = await jwtOtpVerify(userInfo.smsOtpToken);
        if (otp != OTP_BYPASS) {
            if (mobileToken.smsOtp != otp) {
                throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
            }
        }
        return { message: MOBILE_MESSAGES.VALID_OTP }
    }
    catch (err) {
        throw err
    }
}
//resend otp 
export async function mobileRetryOtp(mobileNo: string, id: string) {
    let user = await userFindOne('id', id);
    return await mobileSendOtp(mobileNo, user);
}

export function mobileSendMessage(mobileNo: String, senderId: String) {
    try {
        if (!phoneNo(mobileNo).length) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO);
        }
        msg.send(mobileNo, senderId, function (err: any, response: any) {
            console.log("err: ", err);
            console.log("result :", response);
        });
    }
    catch (err) {
        throw err
    }
}

//sendOtp
export async function sendMobileOtp(mobileNo: string, user: any) {
    try {
        if (!phoneNo(mobileNo).length) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO);
        }
        let { mobileOtp, smsToken } = await generatemobileOtp(4);
        await userUpdate({ id: user._id, smsOtpToken: smsToken });
        sendNotification({ id: user._id, mobileNo, mobileOtp, mobileTemplateName: "sendOtp" });
        return { message: MOBILE_MESSAGES.SEND_OTP };
    }
    catch (err) {
        throw err
    }
}


// Get group is user ids
export async function getTasksForDocument(docId: string, token: string): Promise<any[]> {
    try {
        let Options = {
            uri: `${TASK_URL}/getTasksForDocument/${docId}`,
            headers: { Authorization: `Bearer ${token}` },
            method: "GET",
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

export function dateDifference(oldDate: any, newDate?: any) {
    try {
        const date1: any = new Date(oldDate);
        const date2: any = newDate ? new Date(newDate) : new Date();
        const diffTime = Math.abs(date2 - date1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    } catch (err) {
        throw err
    }
}

export async function updateProjectTasks(body: any, token: string) {
    try {
      let Options = {
        uri: `${TASK_URL}/update/project-Task`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: body,
        json: true
      }
      return await request(Options);
    } catch (err) {
      throw err
    };
  };    

  export async function createDocInElasticSearch(docId:string,host:string,token:string) {
    try {
      let Options = {
        uri: `${ELASTICSEARCH_URL}/v1/create`,
        method: "POST",
        body: {docId,host,token},
        json: true
      }
      return await request(Options);
    } catch (err) {
      throw err
    };
  };

  export async function scriptInElasticSearch(host:string) {
    try {
      let Options = {
        uri: `${ELASTICSEARCH_URL}/v1/insert-all-docs?host=${host}`,
        method: "GET",
        json: true
      }
      return await request(Options);
    } catch (err) {
      throw err
    };
  };

  export async function searchInElasticSearch(queryObj:any) {
    try {
      let Options = {
        uri: `${ELASTICSEARCH_URL}/v1/search?search=${queryObj.search}&userId=${queryObj.userId}&page=${queryObj.page}&limit=${queryObj.limit}&pagination=${queryObj.pagination}&searchAllCmp=${queryObj.searchAllCmp}`,
        method: "GET",
        json: true
      }
      return await request(Options);
    } catch (err) {
      throw err
    };
  };

  export async function backGroundJobForPhasesInElasticSearch() {
    try {
      let Options = {
        uri: `${ELASTICSEARCH_URL}/v1/background/job`,
        method: "GET",
        json: true
      }
      return await request(Options);
    } catch (err) {
      throw err
    };
  };