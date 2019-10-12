import bodyParser = require("body-parser");

//  Invite User Email Template
export function inviteUserForm(body: any) {
    try {
        const text = `
        Hi,<br/></br>
        <br/>
        You are invited by an Administrator of CMP platform to join for the role of <b>${body.role}.</b><br/>
        <br/>
        You can proceed with your registration by accepting invitation by clicking on the following <a href=${body.link}>link</a>.<br/>
        <br/>
        Please ignore if you think this is not intended for you. <br/>
        <br/>
        Best Regards,<br/>
        CITIIS Management Platform Team
        `
        return text;
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Forgot Password Email Template
export function forgotPasswordForm(body: any) {
    try {
        const text = 
            `Hello <b>${body.username}</b>,<br><br>
            <u>${body.otp}</u> is the One Time Password (OTP) to activate your CMP account.
            The OTP is valid for 30 minutes.
            <br/>
            <br/>
            Best Regards,<br/>
            CMP Support.`

        return text;
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Document Invite Email Template
export function docInvitePeople(body: any) {
    try {
        const text = `
        Dear  ${body.username},<br/></br>
        <br/>
        You are invited by an user of CMP to collaborate on the document <b>${body.documentName}</b><br/>
        <br/>
        You can click this <a href="${body.documentUrl}">link</a> to access it. <br/>
        Please ignore if you think this is not intended for you. <br/>
        <br/>
        Best Regards,<br/>
        CITIIS Management Platform Team
        `
        return text;
    } catch (err) {
        console.log(err);
        throw err;
    };
};
export function userLoginForm(body: any){
    try {
        const text = `Welcome to <h>CMP<h>`
        return text;
    } catch (err) {
        console.log(err);
        throw err;
    };
}