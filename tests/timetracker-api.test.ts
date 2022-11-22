import moment from 'moment';
import { ApiCheckRegister, CheckOperation, CheckOperationRegister, CheckState, getApiInstance, TemporalFrame } from '../src/timetracker-api';
import MockDate from 'mockdate'

var api: ApiCheckRegister;
const NITERACIONS = 10;

beforeEach( async () => {
    MockDate.set('2022-04-21T17:00:00');
    api = getApiInstance();
});

afterEach( async () => {
    MockDate.reset();
    indexedDB = new IDBFactory();
});

test("Estat inicial esperat", () => {
    expect(api).not.toBeUndefined();
    expect(api).not.toBeNull();
    expect(api.currentState).toEqual(CheckState.CheckedOutState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    expect(api.lastChange).toBeUndefined();
    expect(api.lastCheckOperation).toBeUndefined();
    expect(api.lastSynchronization).toBeUndefined();
    expect(api.pendingSynchronizeRegisters).toEqual(0);
});

test("Quan comença, el primer autocheck resulta Autoheck-in i stat 'checked-in'", async () => {
    var cop: CheckOperationRegister;

    cop = await api.autoCheckOperation();
    expect(cop).not.toBeUndefined();
    expect(cop).not.toBeNull();
    expect(cop.checkOperation).toEqual(CheckOperation.CheckInOperation);

    expect(api.currentState).toEqual(CheckState.CheckedInState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckOutOperation);
    expect(api.lastChange).not.toBeUndefined();
    expect(api.lastCheckOperation).toEqual(cop.moment);
    expect(api.lastSynchronization).toBeUndefined();
    expect(api.pendingSynchronizeRegisters).toEqual(1);
});

test("Quan comença, diverses operacions de autocheck, aleshores generen els canvis d'estat esperats", async () => {
    var op: CheckOperationRegister;
    var nops: number = 0;
    // Primer, check-in
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    op = await api.autoCheckOperation();
    nops++;
    expect(api.currentState).toEqual(CheckState.CheckedInState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckOutOperation);
    expect(api.lastChange).not.toBeUndefined();
    expect(api.lastCheckOperation).toEqual(op.moment);
    expect(api.lastSynchronization).toBeUndefined();
    expect(api.pendingSynchronizeRegisters).toEqual(nops);
    // Segon, checkout
    op = await api.autoCheckOperation();
    nops++;
    expect(api.currentState).toEqual(CheckState.CheckedOutState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    expect(api.lastChange).not.toBeUndefined();
    expect(api.lastCheckOperation).toEqual(op.moment);
    expect(api.lastSynchronization).toBeUndefined();
    expect(api.pendingSynchronizeRegisters).toEqual(nops);
    // Tercer, checkint
    op = await api.autoCheckOperation();
    nops++;
    expect(api.currentState).toEqual(CheckState.CheckedInState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckOutOperation);
    expect(api.lastChange).not.toBeUndefined();
    expect(api.lastCheckOperation).toEqual(op.moment);
    expect(api.lastSynchronization).toBeUndefined();
    expect(api.pendingSynchronizeRegisters).toEqual(nops);
    // Quart, checkout
    op = await api.autoCheckOperation();
    nops++;
    expect(api.currentState).toEqual(CheckState.CheckedOutState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    expect(api.lastChange).not.toBeUndefined();
    expect(api.lastCheckOperation).toEqual(op.moment);
    expect(api.lastSynchronization).toBeUndefined();
    expect(api.pendingSynchronizeRegisters).toEqual(nops);
});

test("Quan comença, diverses operacions d'a'utocheck, aleshores generen els registres esperats", async () => {
    var expectedOps: CheckOperationRegister[] = [];
    var n: number;

    for (n = 0; n < NITERACIONS; n++) {
        var op = await api.autoCheckOperation();
        expectedOps.push(op);
    }
    // Agafem el dia
    var receivedOps = await api.findOperations(TemporalFrame.ThisDay);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOps.length);
    expect(receivedOps).toEqual(expectedOps);
});

test("Quan comença, faig validació manual d'errors i verifica correctament", async () => {
    var op: CheckOperationRegister;

    op = new CheckOperationRegister(moment().add(1, 'days').toDate().getTime(), CheckOperation.CheckInOperation);
    expect(api.validateManualOperation(op)).toBeFalsy();
    op = new CheckOperationRegister(moment().subtract(1, 'days').toDate().getTime(), CheckOperation.CheckOutOperation);
    expect(api.validateManualOperation(op)).toBeFalsy();

});
test("Quan comença, faig validació manual de correctes i verifica correctament", async () => {
    var op: CheckOperationRegister;

    op = new CheckOperationRegister(moment().subtract(1, 'hours').toDate().getTime(), api.nextCheckOperation);
    expect(api.validateManualOperation(op)).toBeTruthy();

    op = new CheckOperationRegister(Date.now(), api.nextCheckOperation);
    expect(api.validateManualOperation(op)).toBeTruthy();
});

test("Quan comença, diverses operacions de manual check vàlides, aleshores generen els registres esperats", async () => {
    var expectedOps: CheckOperationRegister[] = [];
    var n: number;

    for (n = NITERACIONS; n > 0; n--) {
        var op = await api.manualCheckOperation(moment().subtract(n, 'hours').toDate().getTime(), api.nextCheckOperation);
        expectedOps.push(op);
    }
    // Ara verifiquem
    var receivedOps = await api.findOperations(TemporalFrame.All);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOps.length);
    expect(receivedOps).toEqual(expectedOps);
});

test("Quan comença, diverses operacions de fa més d'un mes, desprès algunes d'aquest mes, aleshores generen els registres esperats", async () => {

    var expectedOpsMes: CheckOperationRegister[] = [];
    var expectedOpsWeek: CheckOperationRegister[] = [];
    var expectedOpsDay: CheckOperationRegister[] = [];
    var expectedOps: CheckOperationRegister[] = [];
    var n: number;

    // Add NITERACIONS elements at date - 1 months
    for (n = NITERACIONS; n > 0; n--) {
        var op = await api.manualCheckOperation(moment().subtract(1, 'months').add(n, 'minutes').toDate().getTime(), api.nextCheckOperation);
        expectedOps.push(op);
    }
    // Test
    var receivedOps = await api.findOperations(TemporalFrame.ThisMonth);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(0);

    receivedOps = await api.findOperations(TemporalFrame.ThisWeek);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(0);

    receivedOps = await api.findOperations(TemporalFrame.ThisDay);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(0);

    // Now, a week ago
    for (n = 0; n <= NITERACIONS; n++) {
        var op = await api.manualCheckOperation(moment().subtract(1, 'weeks').add(n, 'minutes').toDate().getTime(), api.nextCheckOperation);
        expectedOps.push(op);
        expectedOpsMes.push(op);
    }

    // Now, this week
    for (n = 0; n <= NITERACIONS; n++) {
        var op = await api.manualCheckOperation(moment().startOf('week').add(1, 'days').add(n, 'minutes').toDate().getTime(), api.nextCheckOperation);
        expectedOps.push(op);
        expectedOpsMes.push(op);
        expectedOpsWeek.push(op);
    }
    // Now today
    for (n = 0; n <= NITERACIONS; n++) {
        var op = await api.manualCheckOperation(moment().startOf('day').add(4, 'hours').add(n, 'minutes').toDate().getTime(), api.nextCheckOperation);
        expectedOps.push(op);
        expectedOpsMes.push(op);
        expectedOpsWeek.push(op);
        expectedOpsDay.push(op);
    }

    // Now, test
    receivedOps = await api.findOperations(TemporalFrame.All);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOps.length);

    // Month
    receivedOps = await api.findOperations(TemporalFrame.ThisMonth);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOpsMes.length);

    // Week
    receivedOps = await api.findOperations(TemporalFrame.ThisWeek);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOpsWeek.length);
    expect(receivedOps).toEqual(expectedOpsWeek);

    // Day
    receivedOps = await api.findOperations(TemporalFrame.ThisDay);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOpsDay.length);
    expect(receivedOps).toEqual(expectedOpsDay);
});

test("Quan comença, el comptador de temps transcorregut retorna -1", async () => {
    var expected = -1;
    var received = api.timeSinceLastOperation();
    expect(received).not.toBeUndefined();
    expect(received).toEqual(expected);
});

test("Quan comença, en afegir un check, el comptador de temps transcorregut correspon amb l'esperat", async () => {
    var op : CheckOperationRegister;
    
    op = await api.autoCheckOperation();
    MockDate.set(moment().add(3, 'minutes').toDate());
    var expected = Date.now() - op.moment;
    var received = api.timeSinceLastOperation();
    expect(received).not.toBeUndefined();
    expect(received).toEqual(expected);
});