import * as Mocha from 'mocha';
import * as path from 'path';

const mocha = new Mocha({
    ui: 'bdd',
    color: true
});

const testFile = path.join(__dirname, 'roxygen.test.js');
mocha.addFile(testFile);

mocha.run((failures: number) => {
    process.exitCode = failures ? 1 : 0;
});
