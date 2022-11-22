import moment from 'moment';
import { DbStorage_Api, IndexDefinition, instantiateDb } from './timetracker-db';

const TIMETRACKER_DBNAME = "DBTIMETRACKER";
const MOMENTS_IDX_NAME = 'idx_moments';

export enum CheckState {
    CheckedInState = "CheckedIn",
    CheckedOutState = "CheckedOut"
}

export enum CheckOperation {
    CheckInOperation = "CheckInOperation",
    CheckOutOperation = "CheckOutOperation"
}

export class CheckOperationRegister {
    public moment: number;
    public checkOperation: CheckOperation;
    public constructor (moment: number, operation: CheckOperation) {
        this.moment = moment;
        this.checkOperation = operation;
    }
    static copyOf(reg:CheckOperationRegister) : CheckOperationRegister {
        return new CheckOperationRegister(reg.moment, reg.checkOperation);
    } 
}

export enum TemporalFrame {
    ThisDay,
    ThisWeek,
    ThisMonth,
    All
}

/**
 * Timetracker API management.
 */
export interface ApiCheckRegister {
    /**
     * Get the time of last change, as operation or synchronization.
     * @return The time of last change
     */
    get lastChange() : number | undefined;
    /**
     * Get the current state.
     * @return The current state
     */
    get currentState(): CheckState;
    /**
     * Get the time of last check operation, or none if no one operation was applied.
     * @return The time of last applied operation or undefined otherwise
     */
    get lastCheckOperation(): number | undefined;
    /**
     * Get the time of last synchronization.
     * @return The last time synchronization was made or 'undefined' if none was made yet
     */
    get lastSynchronization(): number | undefined;
    /**
     * Get the number of pending synchronization operations.
     * @return a number, greater or equals to zero, that indicates the number of pending synchronizations
     */
    get pendingSynchronizeRegisters(): number;
    /**
     * Gets the next automatic check operation based on {@link currentState}.
     * @return The next check operation
     */
    get nextCheckOperation(): CheckOperation;
    /**
     * Validate if the indicated operation is correct or not, based on {@link currentState} and the moment of the register.
     * @param register The register to validate
     * @return true is is correct and false if not
     */
    validateManualOperation(register: CheckOperationRegister): boolean;
    /**
     * Made an automatic check operaqtion based on {@link currentState} and with the current moment.
     * @return The corresponding register.
     */
    autoCheckOperation(): Promise<CheckOperationRegister>;
    /**
     * Made a manual check operation.
     * @param moment The moment of the operation
     * @param operation The operation
     * @return the automatic created register
     */
    manualCheckOperation(moment: number, operation: CheckOperation): Promise<CheckOperationRegister>;
    /**
     * Find the operations made in the indicated 'temporalFrame'
     * @param temporalFrame The temporal frame
     * @return The collection of registers made in the indicated temporal frame
     */
    findOperations(temporalFrame: TemporalFrame): Promise<CheckOperationRegister []>;
    /**
     * Calculates the time since last operation until now.
     * @return The time or -1 if no operation was made yet
     */
    timeSinceLastOperation():number;
}

class ApiCheckRegisterImpl implements ApiCheckRegister {
    private _checkOperation: CheckOperationRegister | undefined;
    private _lastSyncrhonization: number | undefined;
    private _pendingSyncrhonizationRegisters: number;

    private _tsLasChange: number | undefined;
    private _currentState: CheckState;

    private _dbstorage : DbStorage_Api<CheckOperationRegister> | undefined;

    constructor () {
        this._lastSyncrhonization = undefined;
        this._pendingSyncrhonizationRegisters = 0;
        this._tsLasChange = undefined;
        this._currentState = CheckState.CheckedOutState;
        this._checkOperation = undefined;
    }

    get lastChange(): number | undefined {
        return this._tsLasChange;
    }

    get currentState(): CheckState {
        return this._currentState;
    }
    get lastCheckOperation(): number | undefined {
        if(this._checkOperation == undefined) {
            return undefined;
        }
        return this._checkOperation.moment;
    }
    get lastSynchronization(): number | undefined {
        return this._lastSyncrhonization;
    }
    get pendingSynchronizeRegisters(): number {
        return this._pendingSyncrhonizationRegisters;
    }
    get nextCheckOperation(): CheckOperation {
        if(this._currentState === CheckState.CheckedInState) {
            return CheckOperation.CheckOutOperation;
        } else {
            return CheckOperation.CheckInOperation;
        }
    }
    async autoCheckOperation(): Promise<CheckOperationRegister> {
        var reg : CheckOperationRegister;

        reg = new CheckOperationRegister(Date.now(), this.nextCheckOperation);
        const ret = await this.registerOp(reg);
        return new Promise((resolve,) => {
            resolve(ret);
        })
    }
    async manualCheckOperation(moment: number, operation: CheckOperation): Promise<CheckOperationRegister> {
        var reg : CheckOperationRegister;

        reg = new CheckOperationRegister(moment, operation);
        if ( ! this.validateManualOperation(reg) ) {
            throw new Error("La operació indicada no és pas vàlida!");
        }
        return this.registerOp(reg);
    }

    async findOperations(temporalFrame: TemporalFrame): Promise<CheckOperationRegister[]> {
        var dStart : number;
        var dEnd : number;

        return new Promise( async (resolve, ) => {
            const db = await this.dbCheckAndOpen();
            if(temporalFrame == TemporalFrame.All) {
                const resultat = await db.getAllRegisters();
                resolve(resultat);
            } else {
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
                const resultat = await db.findRegistersByIndex(MOMENTS_IDX_NAME, dStart, dEnd);
                resolve(resultat);
            }
        });
    }

    validateManualOperation(register: CheckOperationRegister): boolean {
        return (register.moment <= Date.now()
            && register.checkOperation == this.nextCheckOperation);
    }

    timeSinceLastOperation(): number {
        if(this._checkOperation != undefined) {
            return Date.now() - this._checkOperation.moment;
        }
        return -1;
    }

    private async registerOp(reg: CheckOperationRegister) : Promise<CheckOperationRegister> {
        this._checkOperation = CheckOperationRegister.copyOf(reg);
        this._tsLasChange = Date.now();
        this._currentState = (reg.checkOperation === CheckOperation.CheckInOperation ? CheckState.CheckedInState : CheckState.CheckedOutState);
        this._pendingSyncrhonizationRegisters++;
        await this.dbRegisterOp(reg);
        return reg;
    }

    private async dbRegisterOp(reg: CheckOperationRegister) {
        if(this._dbstorage === undefined) {
            this._dbstorage = await this.dbCheckAndOpen();
        }
        await this._dbstorage.addRegister(reg);
    }

    private async dbCheckAndOpen() : Promise<DbStorage_Api<CheckOperationRegister>> {
        return new Promise(async (resolve, reject) => {
            instantiateDb<CheckOperationRegister>(TIMETRACKER_DBNAME, [new IndexDefinition(MOMENTS_IDX_NAME, "moment", false)]).then((((value: DbStorage_Api<CheckOperationRegister>) => {
                if(!value.checkStatus) {
                    reject("Cannot open DB!");
                }
                resolve(value);
            })));
        });
    }
}

export function getApiInstance() : ApiCheckRegister {
    return new ApiCheckRegisterImpl();
}

