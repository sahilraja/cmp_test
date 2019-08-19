

export function invite_user_form(body: any) {
    try {
        const text = `
        hi ${body.username}<br/>,
        you are invited for this role ${body.role}<br/> 
        <a href=${body.link}>click here</a> and proceed your registration<br/>
        <br/>
        <br/>
        Best Regards,<br/>
        Transerve Support.
        `
    } catch (err) {
        console.log(err);
        throw err;
    }
}