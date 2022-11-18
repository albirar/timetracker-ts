/**
 * API for db operations
 */

const DB_NAME : string = "timetracker-db";
const OBJECT_STORE_NAME : string = "registers";
 
export interface DbStorage_Api<T> {
    checkStatus() : boolean;
    addRegister(register: T) : Promise<T>;
    getLastRegister() : Promise<T>;
    getRegisterByIndex(indexName : string, value : any) : Promise<T>;
    findRegistersByIndex(indexName : string, value : any, secondValue?: any) : Promise<T[]>;
    getAllRegisters() : Promise<T[]>;
    countRegisters() : Promise<number>;
}

export class IndexDefinition {
    private _indexName : string;
    private _indexProperty : string;
    private _unique : boolean;
    public constructor(indexName: string, indexProperty: string, unique?:boolean) {
        this._indexName = indexName;
        this._indexProperty = indexProperty;
        this._unique = (unique == undefined ? true : unique);
    }
    get indexName() : string {
        return this._indexName;
    };
    get indexProperty() : string {
        return this._indexProperty;
    };
    get unique() : boolean {
        return this._unique;
    };
}

export async function instantiateDb<T>(name?: string, indexs? : IndexDefinition[]) : Promise<DbStorage_Api<T>> {
    return await new Promise(async (resolve, reject) => {
        var r: DbStorage_ApiImpl<T>;
        try {
            r = new DbStorage_ApiImpl();
            r.openDb((name === undefined ? DB_NAME : name), indexs).then(() => {
                resolve(r);
            }, (reason:any) => {
                reject(reason);
            });
        }catch(e: any) {
            reject(e.cause);
        }
    });
}

class DbRegister<T> {
    public id : number | undefined;
    public object : T;

    constructor(object : T) {
        this.object = object;
    }
}


class DbStorage_ApiImpl<T> implements DbStorage_Api<T> {
    private _dbName : string;
    private _status : boolean;
    
    constructor() {
        this._status = false;
        this._dbName = DB_NAME;
    }

    checkStatus() : boolean {
        return this._status;
    }

    private async crearIndex(oStore: IDBObjectStore, idxDefinition : IndexDefinition) : Promise<void> {
        return new Promise((resolve, reject) => {
            oStore.createIndex(idxDefinition.indexName, "object." + idxDefinition.indexProperty, idxDefinition);
            oStore.transaction.oncomplete = () => {
                resolve();
            }
            oStore.transaction.onabort = (event) => {
                reject(event);
            }
        });
    }

    async openDb(dbName: string, indexes?: IndexDefinition []) : Promise<void> {
        var dbRequest: IDBOpenDBRequest;
        this._dbName = dbName;
        return new Promise((resolve, reject) => {
            dbRequest = indexedDB.open(this._dbName, 1);
            dbRequest.onerror = (err) => {
                reject(err);
            }
            dbRequest.onsuccess = () => {
                this._status = true;
                resolve();
            }
            dbRequest.onupgradeneeded = async () => {
                const db = dbRequest.result;
                this._status = true;
                let os = db.createObjectStore(OBJECT_STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true 
                });
                if(indexes != undefined) {
                    var n : number;

                    for(n = 0; n < indexes.length; n++) {
                        await this.crearIndex(os, indexes[n]);
                    }
                }
                resolve();
            };
    
        });
    }

    async addRegister(register: T): Promise<T> {
        return new Promise(async (resolve, reject) => {
            const objectStore = await this.openStore(this._dbName, OBJECT_STORE_NAME, 'readwrite');

            let reg : DbRegister<T>;

            reg = new DbRegister(register);
            const request = objectStore.add(reg);
            request.onerror = () => {
                objectStore.transaction.abort();
                reject(request.error);
            }
            request.onsuccess = () => {
                objectStore.transaction.commit();
                resolve(register);
            }
        });
    }
    async getLastRegister(): Promise<T> {
        return new Promise(async (resolve, reject) => {
            const objectStore = await this.openStore(this._dbName, OBJECT_STORE_NAME, 'readonly');

            let reg : DbRegister<T>;

            const request = objectStore.openCursor(null,"prevunique");
            request.onerror = () => {
                reject(request.error);
            }
            request.onsuccess = () => {
                const cursor = request.result;
                if(cursor) {
                    reg = cursor.value;
                    resolve(reg.object);
                } else {
                    reject("Sense registres");
                }
            }
        });
    }

    async getRegisterByIndex(indexName: string, value: any): Promise<T> {
        return new Promise(async (resolve, reject) => {
            const objectStore = await this.openStore(this._dbName, OBJECT_STORE_NAME, 'readonly');

            if(objectStore.indexNames.contains(indexName)) {
                const idx = objectStore.index(indexName);
                const key = IDBKeyRange.only(value);

                const request = idx.get(key);
                request.onerror = () => {
                    reject(request.error);
                }
                request.onsuccess = () => {
                    const dbreg = request.result;
                    if(dbreg) {
                        const reg = dbreg.object;
                        resolve(reg);
                    } else {
                        reject(`Objecte amb clau '${value}' no tobat!`);
                    }
                }
            } else {
                reject(`No hi ha cap índex anomenat '${indexName}'`);
            }
        });
    }

    async findRegistersByIndex(indexName: string, value: any, secondValue?: any): Promise<T[]> {
        let retorn : T[] = [];
        
        return new Promise(async (resolve, reject) => {
            const objectStore = await this.openStore(this._dbName, OBJECT_STORE_NAME, 'readonly');
            if(objectStore.indexNames.contains(indexName)) {
                let key : IDBKeyRange;

                if(secondValue === undefined) {
                    key = IDBKeyRange.lowerBound(value);
                } else {
                    key = IDBKeyRange.bound(value, secondValue);
                }

                const request = objectStore.openCursor(key, 'nextunique');
                request.onerror = () => {
                    reject(request.error);
                }
                request.onsuccess = () => {
                    const cursor = request.result;
                    if(cursor) {
                        const reg = cursor.value;
                        retorn.push(reg.object);
                        cursor.continue();
                    }
                    resolve(retorn);
                }
            } else {
                reject(`No hi ha cap índex anomenat '${indexName}'`);
            }
        });
    }

    async getAllRegisters(): Promise<T[]> {
        return new Promise(async (resolve, reject) => {
            const objectStore = await this.openStore(this._dbName, OBJECT_STORE_NAME, 'readonly');
            const request = objectStore.getAll();
            request.onerror = (ev) => {
                reject(ev);
            }
            request.onsuccess = () => {
                let uRegs : T[] = [];
                var regs : DbRegister<T>[];

                regs = request.result;
                regs.forEach(reg => {
                    uRegs.push(reg.object);
                });
                resolve(uRegs);
            }
        });
    }
    async countRegisters(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            const objectStore = await this.openStore(this._dbName, OBJECT_STORE_NAME, 'readonly');
    
            const request = objectStore.count();
            request.onerror = () => {
                reject(request.error);
            }
            request.onsuccess = () => {
                resolve(request.result);
            }
        });
    }

    private async openStore(dbName:string, dbStore: string, openMode : IDBTransactionMode) : Promise<IDBObjectStore> {
        return new Promise((resolve, reject) => {
            if(!this._status) {
                reject("Base de dades no preparada!");
            }

            let dbRequest: IDBOpenDBRequest;
            var db : IDBDatabase;

            dbRequest = indexedDB.open(dbName, 1);
            dbRequest.onerror = (ev) => {
                reject(ev);
            }
            dbRequest.onsuccess = () => {
                db = dbRequest.result;
                const tx = db.transaction(dbStore, openMode);
                tx.onabort = (ev) => {
                    throw new Error(`Transacció abortada! (${ev})`);
                }
                tx.onerror = (ev) => {
                    throw new Error(`Error en transacció! (${ev})`);
                }
                const objectStore = tx.objectStore(dbStore);
                resolve(objectStore);
            }
        });
    }
}