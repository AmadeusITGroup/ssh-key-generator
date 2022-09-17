export class CancelError extends Error {
    constructor(args: any) {
        super(args);
        this.name = "CancelProcess"
    }
}