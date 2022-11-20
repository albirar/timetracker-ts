import { ApiCheckRegister, getApiInstance, CheckOperationRegister, CheckOperation, CheckState, TemporalFrame } from '../src/timetracker-api';

var api: ApiCheckRegister;
const NITERACIONS = 10;

beforeEach(() => {
    api = getApiInstance();
});

afterEach(() => {
    indexedDB = new IDBFactory();
});

test("Estat inicial esperat", () => {
    expect(api).not.toBeUndefined();
    expect(api).not.toBeNull();
    expect(api.currentState).toEqual(CheckState.CheckedOutState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
});

test("Quan comença, el primer autocheck resulta Autoheck-in i stat 'checked-in'", async () => {
    var cop : CheckOperationRegister;

    expect(api.currentState).toEqual(CheckState.CheckedOutState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    cop = await api.autoCheckOperation();
    expect(cop).not.toBeUndefined();
    expect(cop).not.toBeNull();
    expect(api.currentState).toEqual(CheckState.CheckedInState);
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckOutOperation);
    expect(cop.checkOperation).toEqual(CheckOperation.CheckInOperation);
});

test("Quan comença, diverses operacions de autocheck, aleshores generen els canvis d'estat esperats", async () => {
    // Primer, check-in
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    await api.autoCheckOperation();
    expect(api.currentState).toEqual(CheckState.CheckedInState);
    // Segon, checkout
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckOutOperation);
    await api.autoCheckOperation();
    expect(api.currentState).toEqual(CheckState.CheckedOutState);
    // Tercer, checkint
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckInOperation);
    await api.autoCheckOperation();
    expect(api.currentState).toEqual(CheckState.CheckedInState);
    // Quart, checkout
    expect(api.nextCheckOperation).toEqual(CheckOperation.CheckOutOperation);
    await api.autoCheckOperation();
    expect(api.currentState).toEqual(CheckState.CheckedOutState);
});

test("Quan comença, diverses operacions de autocheck, aleshores generen els registres esperats", async () => {
    var expectedOps : CheckOperationRegister [] = [];
    var n : number;

    for(n = 0 ; n < NITERACIONS ; n++) {
        var op = await api.autoCheckOperation();
        expectedOps.push(op);
    }
    // Ara el dia
    var receivedOps = await api.findOperations(TemporalFrame.ThisDay);
    expect(receivedOps).not.toBeUndefined();
    expect(receivedOps).not.toBeNull();
    expect(receivedOps.length).toEqual(expectedOps.length);
    expect(receivedOps).toEqual(expectedOps);
});