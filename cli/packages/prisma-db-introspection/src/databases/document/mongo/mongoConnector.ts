import { DocumentConnector } from "../documentConnector"
import { DatabaseType, ISDL } from "prisma-datamodel"
import { DocumentIntrospectionResult } from "../documentIntrospectionResult"
import { MongoClient, Collection } from 'mongodb'

const reservedSchemas = ['admin', 'local']

export class MongoConnector extends DocumentConnector <Collection<Data>>{
  private client: MongoClient
  
  constructor(client: MongoClient) {
    super();
    if(!client.isConnected()) {
      throw new Error('Please connect the mongo client first.')
    } 

    this.client = client
  }

  getDatabaseType(): DatabaseType {
    return DatabaseType.mongo
  }

  async listSchemas(): Promise<string[]> {
    const adminDB = this.client.db().admin()
    const { databases } = await adminDB.listDatabases()
    return databases.map(x => x.name).filter(x => reservedSchemas.indexOf(x) < 0)
  }
  
  protected async getInternalCollections(schemaName: string): Promise<Collection<Data>[]> {
    const db = this.client.db(schemaName)

    const collections = (await db.collections()) as Collection<Data>[]
    return collections
  }
  
  async listModels(schemaName: string): Promise<ISDL> {
    const db = this.client.db(schemaName)

    const collections = await db.collections()

    for(const collection of  collections) {
      const samples = await this.sampleOne(collection)
      console.log(samples)
    }

    throw new Error('Not Implemented')
  }

  // TODO: Lift to strategy
  async *sampleOne(collection: Collection) : AsyncIterableIterator<Data> {
    const data = await collection.findOne<Data>({})

    if(data !== null) {
      yield data
    }
  }

  async *sampleMany(collection: Collection, limit: number) : AsyncIterableIterator<Data> {
    const count = await collection.count({})
    if(count < limit) {
      return this.sampleAll(collection)
    } else {
      let cursor = collection.find<Data>({})
      // TODO: This sampling is biased, but should do the job. 
      for(const skip of this.generateSamples(limit, count)) {
        cursor.skip(skip)
        const data = (await cursor.next())
        if(data === null) {
          throw new Error('Sample many error, cursor returned null for collection: ' + collection.collectionName)
        }
        yield data
      }
    }
  }

  /** 
  * Gets n random numbers chich sum up to sum.
  */
  private *generateSamples(n: number, sum: number) {
    for(let i = 0; i < n; i++) {
      yield Math.floor(Math.random() * sum / n)
    }
  }

  async *sampleAll(collection: Collection) : AsyncIterableIterator<Data> {
    const cursor = await collection.find({})
    while(cursor.hasNext()) {
      const data = (await cursor.next())
      if(data === null) {
        throw new Error('Sample all error, cursor returned null for collection: ' + collection.collectionName)
      }
      yield data
    }
  }
  
  async introspect(schema: string): Promise<DocumentIntrospectionResult> {
    return new DocumentIntrospectionResult(await this.listModels(schema), this.getDatabaseType())
  }


  async exists(collection: Collection, id: any): Promise<boolean> {
    return collection.find({ '_id': id }).hasNext()
  }

}