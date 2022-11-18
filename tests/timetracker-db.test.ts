import { DbStorage_Api, IndexDefinition, instantiateDb } from '../src/timetracker-db';

const NREGISTRES = 10;
const NITERACIONS = 100;

afterEach(() => {
    indexedDB = new IDBFactory();
});


class TestRegister {
    public name: string;
    public age: number;
    public user: string;
    constructor(name: string, age:number, user:string) {
        this.name = name;
        this.age = age;
        this.user = user;
    }
}

test("Obrir base de dades", async () => {
    var db:DbStorage_Api<TestRegister>;

    db = await instantiateDb<TestRegister>(undefined,[new IndexDefinition('user','user')]);
    expect(db).not.toBeUndefined();
    expect(db).not.toBeNull();
    expect(db.checkStatus()).toBeTruthy();
});

test("Crear registre", async () => {
    var db:DbStorage_Api<TestRegister>;
    var expected:TestRegister;
    var actual:TestRegister;

    db = await instantiateDb<TestRegister>(undefined,[new IndexDefinition('user','user')]);

    expected = new TestRegister("test-1", 25, 'usr-test-1');
    actual = await db.addRegister(expected);
    expect(actual).toEqual(expected);
});

test("Crear diversos registres i llegir el darrer", async () => {
    var db:DbStorage_Api<TestRegister>;
    var reg:TestRegister;
    var expected : TestRegister;
    var n: number;
    var age: number;

    expected = new TestRegister('test', 100, 'usr-test');;
    db = await instantiateDb<TestRegister>(undefined,[new IndexDefinition('user','user')]);
    for(n = 0; n < NREGISTRES; n++) {
        age = Math.floor(Math.random() * 60);
        reg = new TestRegister(`test-${n}`, age, `usr-test-${n}`);
        expected = await db.addRegister(reg);
    }
    n = await db.countRegisters();
    expect(n).toEqual(NREGISTRES);
    reg = await db.getLastRegister();
    expect(reg).toEqual(expected);
});
test("Crear diversos registres i llegir diversos aleatòriament", async () => {
    var db:DbStorage_Api<TestRegister>;
    var reg:TestRegister;
    var expected : TestRegister;
    var n: number;
    var idx : number;
    var age: number;
    var regs : TestRegister[] = [];
    
    expected = new TestRegister('test', 100, 'usr-test');;
    db = await instantiateDb<TestRegister>(undefined,[new IndexDefinition('user','user')]);
    for(n = 0; n < NREGISTRES; n++) {
        age = Math.floor(Math.random() * 60);
        reg = new TestRegister(`test-${n}`, age, `usr-test-${n}`);
        regs.push(reg);
        expected = await db.addRegister(reg);
    }
    n = await db.countRegisters();
    expect(n).toEqual(NREGISTRES);
    console.debug("Anem a verificar...");
    for(n = 0; n < NITERACIONS; n++) {
        idx = Math.floor(Math.random() * 10);
        expected = regs[idx];
        reg = await db.getRegisterByIndex('user', `usr-test-${idx}`);
        expect(reg).toEqual(expected);
    }
});

test("Crear diversos registres i llegir-los tots", async () => {
    var db:DbStorage_Api<TestRegister>;
    var reg:TestRegister;
    var n: number;
    var age: number;
    var regs : TestRegister[] = [];
    var actuals : TestRegister[] = [];
    
    db = await instantiateDb<TestRegister>(undefined,[new IndexDefinition('user','user')]);
    for(n = 0; n < NREGISTRES; n++) {
        age = Math.floor(Math.random() * 60);
        reg = new TestRegister(`test-${n}`, age, `usr-test-${n}`);
        regs.push(reg);
        await db.addRegister(reg);
    }
    n = await db.countRegisters();
    expect(n).toEqual(NREGISTRES);
    actuals = await db.getAllRegisters();
    expect(actuals).not.toBeUndefined();
    expect(actuals).not.toBeNull();

    expect(actuals.length).toEqual(regs.length);

    for(n = 0; n < NREGISTRES; n++) {
        expect(actuals[n]).toEqual(regs[n]);
    }
});

test("Crear diversos registres i llegir un grapat per índex", async () => {
    var db:DbStorage_Api<TestRegister>;
    var reg:TestRegister;
    var n: number;
    var age: number;
    var regs : TestRegister[] = [];
    var actuals : TestRegister[] = [];
    
    db = await instantiateDb<TestRegister>(undefined,[new IndexDefinition('user','user')]);
    for(n = 0; n < NREGISTRES; n++) {
        age = Math.floor(Math.random() * 60);
        reg = new TestRegister(`test-${n}`, age, `usr-test-${n}`);
        await db.addRegister(reg);
        age = Math.floor(Math.random() * 1000);
        if(age % 2 == 0) {
            regs.push(reg);
        }
    }
    n = await db.countRegisters();
    expect(n).toEqual(NREGISTRES);
    // Get first and last...
    n = regs.length;
    actuals = await db.findRegistersByIndex('user', regs[0].user, regs[n-1].user);
    expect(actuals).not.toBeUndefined();
    expect(actuals).not.toBeNull();

    expect(actuals.length).toEqual(regs.length);

    for(n = 0; n < NREGISTRES; n++) {
        expect(actuals[n]).toEqual(regs[n]);
    }
});
