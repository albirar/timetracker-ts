import moment from 'moment';
import { DbStorage_Api, IndexDefinition, instantiateDb } from './timetracker-db';

export enum CheckState {
    CheckedInState = "CheckedIn",
    CheckedOutState = "CheckedOut"
}

export enum CheckOperation {
    CheckInOperation = "CheckInOperation",
    CheckOutOperation = "CheckOutOperation"
}

export interface CheckOperationRegister {
    get moment(): number;
    get checkOperation(): CheckOperation;
}

class CheckOperationRegisterImpl implements CheckOperationRegister {
    private _moment: number;
    private _checkOperation: CheckOperation;

    public get moment(): number {
        return this._moment;
    }

    public get checkOperation(): CheckOperation {
        return this._checkOperation;
    }

    public constructor (moment?: number, operation?: CheckOperation) {
        if(moment == undefined) {
            this._moment = Date.now();
        } else {
            this._moment = moment;
        }
        if(operation == undefined) {
            this._checkOperation = getApiInstance().nextCheckOperation;
        } else {
            this._checkOperation = operation;
        }
    }
}

export enum TemporalFrame {
    ThisDay,
    ThisWeek,
    ThisMonth
}

export interface CheckEvent {
    get checkOperation() : CheckOperationRegister;
    get currentState() : CheckState
}

class CheckEventImpl implements CheckEvent {
    private _operation : CheckOperationRegister;
    private _currentState : CheckState;

    constructor(operation : CheckOperationRegister, currentState : CheckState) {
        this._operation = operation;
        this._currentState = currentState;
    }
    get checkOperation(): CheckOperationRegister {
        return this._operation;
    }
    get currentState(): CheckState {
        return this._currentState;
    }

}
export interface ApiCheckRegister {
    get lastChange() : number | undefined;
    get currentState(): CheckState;
    get lastCheckOperation(): number | undefined;
    get lastSynchronization(): number;
    get pendingSynchronizeRegisters(): number;
    get nextCheckOperation(): CheckOperation;

    subscribeToChanges(fn : (event: CheckEvent) => void):number;
    unSubscribeToChanges(id:number):void;

    validateManualOperation(register: CheckOperationRegister): boolean;
    autoCheckOperation(): CheckOperationRegister;
    manualCheckOperation(moment: number, operation: CheckOperation): CheckOperationRegister;
    findOperations(temporalFrame: TemporalFrame): CheckOperationRegister [];
    timeSinceLastOperation():number;
}

class regSbucriber {
    id: number;
    fn: {(event: CheckEvent): void};
    constructor(id: number, fn: {(event: CheckEvent): void}) {
        this.id=id;
        this.fn=fn;
    }

}

class ApiCheckRegisterSingleton implements ApiCheckRegister {
    private static _instance : ApiCheckRegisterSingleton;
    private _checkOperation: CheckOperationRegister | undefined;
    private _lastSyncrhonization: number;
    private _pendingSyncrhonizationRegisters: number;
    private _operations: CheckOperationRegister [];

    private _tsLasChange: number | undefined;
    private _currentState: CheckState;

    private _subscribers : regSbucriber[];

    private _dbstorage : DbStorage_Api<CheckOperationRegister> | undefined;

    constructor () {
        this._lastSyncrhonization = 0;
        this._pendingSyncrhonizationRegisters = 0;
        this._operations = new Array();
        this._tsLasChange = Date.now();
        this._currentState = CheckState.CheckedOutState;
        this._subscribers = new Array();
        this._checkOperation = undefined;
    }

    get lastChange(): number | undefined {
        return this._tsLasChange;
    }

    get currentState(): CheckState {
        return this._currentState;
    }
    get lastCheckOperation(): number {
        if(this._checkOperation == undefined) {
            return 0;
        }
        return this._checkOperation.moment;
    }
    get lastSynchronization(): number {
        return this._lastSyncrhonization;
    }
    get pendingSynchronizeRegisters(): number {
        return this._pendingSyncrhonizationRegisters;
    }
    get nextCheckOperation(): CheckOperation {
        if(this._currentState == CheckState.CheckedInState) {
            return CheckOperation.CheckOutOperation;
        } else {
            return CheckOperation.CheckInOperation;
        }
    }
    subscribeToChanges(fn: (event: CheckEvent) => void): number {
        var regs: regSbucriber = new regSbucriber(Date.now(), fn);
        this._subscribers.push(regs);
        return regs.id;
    }
    unSubscribeToChanges(id: number) {
        this._subscribers = this._subscribers.filter((item) => {
            return item.id != id;
        });
    }
    autoCheckOperation(): CheckOperationRegister {
        var reg : CheckOperationRegisterImpl;

        reg = new CheckOperationRegisterImpl();
        return this.registerOp(reg);
    }
    manualCheckOperation(moment: number, operation: CheckOperation): CheckOperationRegister {
        var reg : CheckOperationRegisterImpl;

        reg = new CheckOperationRegisterImpl(moment, operation);
        if ( ! this.validateManualOperation(reg) ) {
            throw new Error("La operació indicada no és pas vàlida!");
        }
        return this.registerOp(reg);
    }

    findOperations(temporalFrame: TemporalFrame): CheckOperationRegister[] {
        var resultat : CheckOperationRegister [];
        var dStart : number;
        var dEnd : number;

        switch(temporalFrame) {
            case TemporalFrame.ThisDay:
                dStart = moment().startOf('day').toDate().getTime();
                dEnd = moment().endOf('day').toDate().getTime();
            break;

            case TemporalFrame.ThisWeek:
                dStart = moment().startOf('week').toDate().getTime();
                dEnd = moment().endOf('week').toDate().getTime();
            break;

            case TemporalFrame.ThisMonth:
            default:
                dStart = moment().startOf('month').toDate().getTime();
                dEnd = moment().endOf('month').toDate().getTime();
            break;
        }
        resultat = new Array();
        this._operations.forEach(function (reg) {
            if(reg.moment >= dStart && reg.moment <= dEnd) {
                resultat.push(reg);
            }
        });
        return resultat;
    }

    validateManualOperation(register: CheckOperationRegisterImpl): boolean {
        return (register.moment <= Date.now()
            && register.checkOperation != this.nextCheckOperation);
    }

    timeSinceLastOperation(): number {
        if(this._checkOperation != undefined) {
            return Date.now() - this._checkOperation.moment;
        }
        return -1;
    }
    static getInstance() : ApiCheckRegister {
        if (! ApiCheckRegisterSingleton._instance) {
            ApiCheckRegisterSingleton._instance = new ApiCheckRegisterSingleton();
        }
        return ApiCheckRegisterSingleton._instance;
    }

    private registerOp(reg: CheckOperationRegisterImpl) : CheckOperationRegister {
        var event: CheckEventImpl;
        this.dbRegisterOp(reg);
        this._operations.push(reg);
        this._tsLasChange = reg.moment;
        this._currentState = (reg.checkOperation == CheckOperation.CheckInOperation ? CheckState.CheckedInState : CheckState.CheckedOutState);
        event = new CheckEventImpl(reg, this._currentState);
        this._subscribers.forEach((item) => {
            item.fn(event);
        })
        return reg;
    }

    private async dbRegisterOp(reg: CheckOperationRegister) {
        if(this._dbstorage === undefined) {
            this._dbstorage = await this.dbCheckAndOpen();
        }
        this._dbstorage.addRegister(reg);
    }

    private async dbCheckAndOpen() : Promise<DbStorage_Api<CheckOperationRegister>> {
        return new Promise(async (resolve, reject) => {
            instantiateDb<CheckOperationRegister>("DBTIMETRACKER", [new IndexDefinition("idx_moments", "moment", true)]).then((((value: DbStorage_Api<CheckOperationRegister>) => {
                if(!value.checkStatus) {
                    reject("Cannot open DB!");
                }
                resolve(value);
            })));
        });
    }
}

export function getApiInstance() : ApiCheckRegister {
    return ApiCheckRegisterSingleton.getInstance();
}

