

export function invite_user_form(body: any) {
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