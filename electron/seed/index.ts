import MDBReader from "mdb-reader";
import fs from "fs";
import path from "path";
// import {create} from "../db/localDB";

export const initAreas = () => {
    // In development: project root, In production: app path
    const mdbPath = path.join(process.cwd(), 'electron', 'seed', 'smb.mdb');
    const buffer = fs.readFileSync(mdbPath);
    const reader = new MDBReader(buffer);
    const itemdesTable = reader.getTable('areamaster');
    const itemdesData = itemdesTable.getData<Record<string, string>>();

    console.log([...new Set(itemdesData.map(item => item.name))].length, itemdesData.length)

    console.log(itemdesData.filter(i => i.name === "¿ïºÁ¸òÐ Å¡ú¨¸"))

    // const nameCounts: Record<string, number> = {};
    // const duplicates = [];
    //
    // for (const item of itemdesData) {
    //     nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
    // }
    //
    // for (const [name, count] of Object.entries(nameCounts)) {
    //     if (count > 1) duplicates.push(name);
    // }
    //
    // console.log(duplicates);

    // [
    //   'Å¼ìÌ À¡¨ÇÂõ', '¿ïºÁ¸òÐ Å¡ú¨¸',
    //   'Ìîº¢ôÀ¡¨ÇÂõ', '§¾ÅýÌÊ',
    //   'À¢ýÉòà÷',     '¾¢Õ¿¡¨Ãä÷',
    //   '§ºó¾¢Ã¸¢û¨Ç', 'C «ÃÝ÷',
    //   '¿ÎÅ£ÃôÀðÎ',   '¨¾ì¸¡ø',
    //   'À¢øÀÎ¨¸',     'K ÀïºÌôÀõ',
    //   'Ã¡¾¡¿øæ÷',    'Á½ø§ÁÎ',
    //   'º¢. ÒÐ§Àð¨¼', '¯¨¼Â¡÷ÌÊ',
    //   '¬¨½Å¡¡¢',     '¸¨Ã§ÁÎ',
    //   '¾ñ§¼ŠÅÃ¿øæ÷'
    // ]


    // for (const localRecord of itemdesData) {
    //     console.log('creating', {
    //         name: localRecord.name,
    //         pincode: localRecord.pincode,
    //         post: localRecord.post,
    //         town: localRecord.town
    //     })
    //     create('areas', {
    //         name: localRecord.name,
    //         pincode: localRecord.pincode,
    //         post: localRecord.post,
    //         town: localRecord.town
    //     })
    // }
}