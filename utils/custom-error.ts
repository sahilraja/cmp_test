export class APIError extends Error {
    public code : Number;
    constructor(message:string, code = 400) {
        super(message);
        this.code = code
    }
}
