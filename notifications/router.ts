import { Types } from "mongoose";
import { Router, Request, Response, NextFunction } from "express";
import { OK } from "http-status-codes";
import { notificationsUpdate, addRoleNotification, addTemplateNotification, getRoleNotification } from "./module";
import { APIError } from "../utils/custom-error";
import { notificationSchema } from "./model";
const router = Router();


router.post("/update",async(req,res,next)=>{
    try{
        res.status(OK).send(await notificationsUpdate(req.body));
    }
    catch(error){
        next(new APIError(error.message));
    }
})
router.get("/list",async(req,res,next)=>{
    try{
        res.status(OK).send(await notificationSchema.find().exec());
    }
    catch(error){
        next(new APIError(error.message));
    }
})
router.post("/role/add",async(req,res,next)=>{
    try{
        res.status(OK).send(await addRoleNotification(req.body.role));
    }
    catch(error){
        next(new APIError(error.message));
    }
})
router.post("/template/add",async(req,res,next)=>{
    try{
        res.status(OK).send(await addTemplateNotification(req.body));
    }
    catch(error){
        next(new APIError(error.message));
    }
})
router.get("/getNotification",async(req,res,next)=>{
    try{
        res.status(OK).send(await getRoleNotification(req.query.role,req.query.templateName));
    }
    catch(error){
        next(new APIError(error.message));
    }
})
export = router