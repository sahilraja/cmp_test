

export function inviteUserForm(body: any) {
    try {
        const text = `
        Hi  ${body.username},<br/></br>
        you are invited for this role <b>${body.role}</b><br/> 
        <a href=${body.link}>click here</a> and proceed your registration<br/>
        <br/>
        <br/>
        Best Regards,<br/>
        Transerve Support.
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
        <center>
        <p>Hi  ${body.username},</p><br/></br>
        <p> Someone, hopefully you, has requested to reset the password </P></br>
        <p> If you did not perform this request, you can safely ignore this email. </P></br>
        <P> Otherwise, click the link below to complete the process. </p></br>
        <a href=${body.link}>click here</a>
        <br/>
        <br/>
        Best Regards,<br/>
        Transerve Support.
        </center>
        `
        return text
    } catch (err) {
        console.log(err);
        throw err;
    }
}