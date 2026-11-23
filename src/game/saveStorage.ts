let database: Promise<IDBDatabase> | undefined

function openSaves() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('skyline-tycoon', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('saves')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch(error => {
    database = undefined
    throw error
  })
  return database
}

export async function accessSave<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openSaves()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('saves', mode)
    const request = operation(transaction.objectStore('saves'))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error ?? request.error)
  })
}
