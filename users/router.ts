import { Router, Request, Response, Handler } from "express";
import { inviteUser, user_list, edit_user as edit_user, user_status, user_login, userInviteResend, RegisterUser, userDetails, userRoles, userCapabilities, forgotPassword, setNewPassword, createGroup, editGroup, groupList, groupStatus, groupDetail, addMember, removeMembers, userSuggestions, otpVerification, userInformation, changeEmailInfo, getUserDetail, profileOtpVerify, loginHistory, getUsersForProject, mobileVerification, changeMobileNumber } from "./module";
import { authenticate, mobileRetryOtp, mobileVerifyOtp, mobileSendOtp } from "../utils/utils";
import { NextFunction } from "connect";
import { readFileSync } from "fs";
import { join } from "path";
import { changePasswordInfo, uploadPhoto } from "../utils/users";
import { uploadToFileService } from "../documents/module";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { FILES_SERVER_BASE } from "../utils/urls";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
import { roles_list, role_list } from "../role/module";
import { SENDER_IDS } from "../utils/error_msg";
const router = Router();

//  Invite User
router.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await inviteUser(req.body, res.locals.user));
    } catch (err) {
        next(new APIError(err.message));
    };
});

// Register User
router.post("/register/:token", async (req: Request, res: Response, next: NextFunction) => {
    try {
            const payload: any = await uploadToFileService(req)
            // req.body.profilePic = JSON.parse(imageObj).id
        res.status(200).send(await RegisterUser(JSON.parse(payload), req.params.token))
    } catch (err) {
        next(new APIError(err.message));
    };
});


//  Resend invite link
router.get('/invite/resend/:role/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { role, id } = req.params
        res.status(200).send(await userInviteResend(id, role));
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  user list
router.get('/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        req.query.page = req.query.page || 1;
        req.query.limit = 50;
        res.status(200).send(await user_list(req.query, res.locals.user._id, req.query.page, req.query.limit));
    } catch (err) {
        next(new APIError(err.message));
    };
});

router.get(`/detail/:id`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await getUserDetail(req.params.id));
    } catch (err) {
        next(new APIError(err.message));
    };
});
//  Edit User
router.post('/edit/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        //const payload: any = await uploadToFileService(req)
         let payload: any 
        // if(req.file){
        //     payload = await uploadToFileService(req)
        // } else {
        //     payload = JSON.stringify(req.body)
        // }
        const contentType :any= req.get('content-type');
        if (contentType.includes('multipart/form-data')) {
            payload = await uploadToFileService(req)
        }
        if (contentType.includes('application/json')) {
            payload = JSON.stringify(req.body)
        }
        //req.body.profilePic = JSON.parse(imageObj).id
        res.status(OK).send(await edit_user(req.params.id, JSON.parse(payload), res.locals.user));
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  change status user
router.put('/status/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await user_status(req.params.id, res.locals.user));
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  login user
router.post('/email/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await user_login(req));
    } catch (err) {
        next(new APIError(err.message));
    };
});

router.get(`/getImage/:userId`, async (request, response, next) => {
    try {
        const userDetail = await getUserDetail(request.params.userId)
        const req = (FILES_SERVER_BASE as string).startsWith("https") ? 
        httpsGet(`${FILES_SERVER_BASE}/files/${userDetail.profilePic}`, (res: any) => {
            response.setHeader('Content-disposition', 'inline');            
            response.setHeader('Content-type',res.headers['content-type'])
            res.pipe(response);
        }) : httpGet(`${FILES_SERVER_BASE}/files/${userDetail.profilePic}`, (res: any) => {
            response.setHeader('Content-disposition', 'inline');            
            response.setHeader('Content-type',res.headers['content-type'])
            res.pipe(response);
        });
        req.on('error', (e: Error) => {
            next(e);
        });
        req.end();
    } catch (err) {
        next(new APIError(err.message));
    };
});
// Get user Details
router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userDetails(res.locals.user._id));
    } catch (err) {
        next(new APIError(err.message));
    };
});

// Get user roles
router.get("/me/role", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userRoles(res.locals.user._id));
    } catch (err) {
        next(new APIError(err.message));
    };
});

// Get user capabilities
router.get("/me/capabilities", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userCapabilities(res.locals.user._id));
    } catch (err) {
        next(new APIError(err.message));
    };
});

// Forgot Password
router.post("/forgot", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await forgotPassword(req.body));
    } catch (err) {
        next(new APIError(err.message));
    };
});

router.post("/forgot/verify", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await otpVerification(req.body));
    }
    catch (err) {
        next(new APIError(err.message));
    }
});

// Set New Password
router.post("/forgot/setPassword", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await setNewPassword(req.body));
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  Add Group
router.post("/group/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await createGroup(req.body, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  List Group
router.get("/group/list", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await groupList(res.locals.user._id))
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  Edit Group
router.put("/group/:id/edit", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await editGroup(req.body, req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  edit status of group
router.put("/group/:id/status", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await groupStatus(req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  Add Member
router.post("/group/:id/member/add", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await addMember(req.params.id, req.body.users, res.locals.user));
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  Remove Member
router.post("/group/:id/member/remove", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await removeMembers(req.params.id, req.body.users, res.locals.user));
    } catch (err) {
        next(new APIError(err.message));;
    };
});

//  Get User suggestion
router.get("/suggestion", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userSuggestions(req.query.search, res.locals.user._id, req.query.searchKeys));
    } catch (err) {
        next(new APIError(err.message));;
    };
});

router.get(`/getUsersForProject`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await getUsersForProject(req.query.search, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

//  Group Details
router.get("/group/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await groupDetail(req.params.id));
    } catch (err) {
        next(new APIError(err.message));;
    };
});
router.get("/countryCodes", async (req, res, next) => {
    try {
        res.status(200).send(JSON.parse(readFileSync(join(__dirname, "..", "utils", "country_codes.json"), "utf8")))
    } catch (err) {
        next(new APIError(err.message));
    }
})

router.get("/userInfo/:id", authenticate, async (req, res, next) => {
    try {
        res.status(200).send(await userInformation(req.params.id));
    } catch (err) {
        next(new APIError(err.message));
    }
})
router.post("/changePassword",authenticate, async (req, res, next) => {
    try {
        res.status(200).send(await changePasswordInfo(req.body,res.locals.user._id));
    } catch (err) {
        next(new APIError(err.message));
    }
})
router.post('/changeEmail',authenticate,async (req,res,next)=>{
    try{
        res.status(200).send(await changeEmailInfo(req.body,res.locals.user));
    }
    catch(err){
        next(new APIError(err.message));;
    }
})

router.post('/profile/otp/verification',authenticate,async (req,res,next)=>{
    try{
        res.status(200).send(await profileOtpVerify(req.body,res.locals.user));
    }
    catch(err){
        next(new APIError(err.message));;
    }
})

router.get(`/getFormattedRoles`, async (req, res, next) => {
    try {
        res.status(OK).send(await role_list())
    } catch (error) {
        next(new APIError(error.message))
    }
})
router.get("/login/history/:id", authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await loginHistory(req.params.id));
    } catch (error) {
        next(new APIError(error.message));
    }
})
router.post("/send/mobileOtp",async(req,res,next)=>{
    try{
        res.status(OK).send(await mobileSendOtp(req.body.phone,SENDER_IDS.OTP));
    }
    catch(error){
        next(new APIError(error.message));
    }
})
router.post("/resend/mobileOtp",async(req,res,next)=>{
    try{
        res.status(OK).send(await mobileRetryOtp(req.body.phone));
    }
    catch(error){
        next(new APIError(error.message));
    }
})

router.post("/mobile/verify",async(req,res,next)=>{
    try{
        res.status(OK).send(await mobileVerifyOtp(req.body.phone,req.body.otp));
    }
    catch(error){
        next(new APIError(error.message));
    }
})

router.post("/change/mobile",authenticate,async(req,res,next)=>{
    try{
        res.status(OK).send(await changeMobileNumber(req.body,res.locals.user));
    }
    catch(error){
        next(new APIError(error.message));
    }
})
export = router;