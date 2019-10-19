export class APIError extends Error {
    public code : Number;
    constructor(message:any, code = 400) {
        const regex = /@()@|([{}":\[/\]/,])/g;
        message = message.replace(regex, '').replace(/error(s)?/gi, '').split('-').pop().trim()
        super(message);
        this.code = code
    }
}
