import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NYC = require('nyc');


// Recommended modules, loading them here to speed up NYC init
// and minimize risk of race condition
import 'ts-node/register';
import 'source-map-support/register';

export async function run(): Promise<void> {
    // Setup coverage pre-test, including post-test hook to report
    const nyc = new NYC({
        cwd: path.join(__dirname, '..', '..', '..'),
        reporter: ['text', 'html', 'lcov'],
        all: true,
        silent: false,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
        include: ["out/**/*.js"],
        exclude: ["out/test/**"],
    });
    await nyc.wrap();

    // Check the modules already loaded and warn in case of race condition
    // (ideally, at this point the require cache should only contain one file - this module)
    const myFilesRegex = /ssh-key-generator\/out/;
    const filterFn = myFilesRegex.test.bind(myFilesRegex);
    if (Object.keys(require.cache).filter(filterFn).length > 1) {
        console.warn('NYC initialized after modules were loaded', Object.keys(require.cache).filter(filterFn));
    }

    await nyc.createTempDirectory();

    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '..');

    // Add all files to the test suite
    const files = glob.sync('**/*.test.js', { cwd: testsRoot });
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    const failures: number = await new Promise(resolve => mocha.run(resolve));
    await nyc.writeCoverageFile();

    // Capture text-summary reporter's output and log it in console
    nyc.report();
    console.log(await captureStdout(nyc.report.bind(nyc)));

    if (failures > 0) {
        throw new Error(`${failures} tests failed.`);
    }
}

/**
 * nyc text report is generated on standard output.
 * When unit tests are invoked from the pipeline (npm run coverage), this is fine
 * as we get direct access to standard output.
 * However, when invoked from VSCode 'Launch unit tests with coverage' task, we only
 * have access to console.log. The below function will make sure that in this case
 * we retrieve the standard output in a variable and send back to console log.
 * @param fn 
 * @returns 
 */
async function captureStdout(fn: any) {
    const writeDesc = Object.getOwnPropertyDescriptor(process.stdout, 'write');
    if (writeDesc && !writeDesc.writable) {
        await fn();
        return '';
    } else {
        const w = process.stdout.write;
        let buffer = '';
        process.stdout.write = (s: string) => {
            buffer = buffer + s;
            return true;
        };
        await fn();
        process.stdout.write = w;
        return buffer;
    }
}
