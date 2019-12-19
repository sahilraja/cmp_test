export class APIError extends Error {
    public code : Number;
    constructor(message:any, code = 400) {
        const regex = /@()@|([{}":\[/\]/])/g;
        message = message.replace(regex, '').replace(`errors`, `error`).replace(/error/gi, '').split('-').pop().trim()
        super(message);
        this.code = code
    }
}

export class FormattedAPIError extends Error {
    public code : Number;
    constructor(message:any, shouldFormatError: boolean, code = 400, ) {
        const regex = /@()@|([{}":\[/\]/])/g;
        if(shouldFormatError){
            message = message.replace(regex, '').replace(/error(s)?/gi, '').split('-').pop().trim()
        }
        super(message);
        this.code = code
    }
}
