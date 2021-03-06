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
        console.error(err);
        throw err;
    };
};

//  Forgot Password Email Template
export function forgotPasswordForm(body: any) {
    try {
        const text =
            `Hello <b>${body.fullName}</b>,<br><br>
            <u>${body.otp}</u> is the One Time Password (OTP) to activate your CMP account.
            <br/>
            <br/>
            Best Regards,<br/>
            CMP Support.`

        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
};

export function profileOtp(body: any) {
    try {
        const text =
            `Hello <b>${body.fullName}</b>,<br><br>
            <u>${body.otp}</u> is the One Time Password (OTP) to update your CMP account.
            <br/>
            <br/>
            Please ignore if you think this is not intended for you. <br/>
            <br/>
            Best Regards,<br/>
            CITIIS Management Platform Team`

        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
};

//  Document Invite Email Template
export function docInvitePeople(body: any) {
    try {
        const text = `
        Hi,<br/></br>
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
        console.error(err);
        throw err;
    };
};
export function userLoginForm(body: any) {
    try {
        const text = `Welcome to <h>CMP<h>`
        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
}
export function userState(body: any){
    try {
        const text = `Your account has been ${body.state} | CMP`
        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
}

export function suggestTagNotification(body: any) {
    try {
        const text = `
        Hi,<br/></br>
        <br/>
        <b>${body.userName}</b> suggested a tag.<br/>
        <br/>
        You can click this <a href="${body.documentUrl}">link</a> to view it. <br/>
        Please ignore if you think this is not intended for you. <br/>
        <br/>
        Best Regards,<br/>
        CITIIS Management Platform Team
        `
        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
};

export function approveTagNotification(body: any) {
    try {
        const text = `
        Hi,<br/></br>
        <br/>
        <b>${body.fullName}</b>has been approved a tag suggested by you.<br/>
        <br/>
        You can click this <a href="${body.documentUrl}">link</a> to view it.<br/>
        Please ignore if you think this is not intended for you. <br/>
        <br/>
        Best Regards,<br/>
        CITIIS Management Platform Team
        `
        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
};

export function rejectTagNotification(body: any) {
    try {
        const text = `
        Hi,<br/></br>
        <br/>
        <b>${body.fullName}</b> has neen rejected a tag suggested by you.<br/>
        <br/>
        You can click this <a href="${body.documentUrl}">link</a> to view it.<br/>
        Please ignore if you think this is not intended for you. <br/>
        <br/>
        Best Regards,<br/>
        CITIIS Management Platform Team
        `
        return text;
    } catch (err) {
        console.error(err);
        throw err;
    };
};