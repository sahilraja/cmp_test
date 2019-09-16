

export function inviteUserForm(body: any) {
    try {
        const text = `
        Dear  ${body.username},<br/></br>
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
        return text
    } catch (err) {
        console.log(err);
        throw err;
    }
}

export function forgotPasswordForm(body: any) {
    try {
        const text = `
        <p>Hi  ${body.username},</p><br/></br>
        <p> Someone, hopefully you, has requested to reset the password </P></br>
        <p> If you did not perform this request, you can safely ignore this email. </P></br>
        <P> Otherwise, click the link below to complete the process. </p></br>
        <a href=${body.link}>click here</a>
        <br/>
        <br/>
        Best Regards,<br/>
        CMP Team.
        `
        return text
    } catch (err) {
        console.log(err);
        throw err;
    }
}

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
        return text
    } catch (err) {
        console.log(err);
        throw err;
    }
}