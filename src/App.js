import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import Biconomy from "@biconomy/mexa";
import Web3 from "web3";
import { toBuffer } from "ethereumjs-util";
var abi = require("ethereumjs-abi");
const { config } = require("./config");

let chainId = 80001;
let web3;
let contract;

function App() {
  const [quote, setQuote] = useState("This is a default quote");
  const [owner, setOwner] = useState("Default Owner Address");
  const [newQuote, setNewQuote] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [error, setError] = useState("");
  const [metaTxEnabled, setMetaTxEnabled] = useState(true);

  useEffect(() => {
    const init = async () => {
      console.log("Initialising");
      if (window.ethereum) {
        try {
          const provider = window.ethereum;
          const biconomy = new Biconomy(provider, {
            apiKey: "NMbKZW9mU.0a6aa63d-77bf-4288-9ad1-d0bc38b3ebeb",
            debug: true,
          });
          await provider.enable();
          web3 = new Web3(biconomy);

          biconomy
            .onEvent(biconomy.READY, () => {
              contract = new web3.eth.Contract(
                config.contract.abi,
                config.contract.address
              );
              setSelectedAddress(provider.selectedAddress);
              // getQuoteFromNetwork();
              provider.on("accountsChanged", function (accounts) {
                setSelectedAddress(accounts[0]);
              });
            })
            .onEvent(biconomy.ERROR, (err, message) => {
              alert(err);
              console.log(err, message);
            });
        } catch (error) {
          // User denied account access...
          alert("Please allow access to connect to web3 ");
        }
      }
      // Legacy dapp browsers...
      else if (window.web3) {
        window.web3 = new Web3(web3.currentProvider);
        // Acccounts always exposed
        web3.eth.sendTransaction({
          /* ... */
        });
      }
      // Non-dapp browsers...
      else {
        alert(
          "Non-Ethereum browser detected. You should consider trying MetaMask!"
        );
      }
    };
    init();
  }, []);

  const getQuoteFromNetwork = () => {
    if (contract) {
      contract.methods
        .getQuote()
        .call()
        .then(function (result) {
          console.log(result);
          setQuote(result.currentQuote);
        });
    }
  };

  const setQuoteOnNetwork = () => {
    if (contract) {
      contract.methods
        .setQuote("New Quote")
        .send({ from: selectedAddress })
        .then((result) => {
          console.log(result);
        });
    }
  };

  const setQuoteViaMetaTX = async () => {
    if (contract) {
      console.log("Sending meta transaction");
      let nonce = await contract.methods.getNonce(selectedAddress).call();
      let functionSignature = contract.methods
        .setQuote("New Quote via meat TX")
        .encodeABI();
      let messageToSign = constructMetaTransactionMessage(
        nonce,
        chainId,
        functionSignature,
        config.contract.address
      );
      const signature = await web3.eth.personal.sign(
        "0x" + messageToSign.toString("hex"),
        selectedAddress
      );

      console.info(`User signature is ${signature}`);
      let { r, s, v } = getSignatureParameters(signature);
      sendTransaction(selectedAddress, functionSignature, r, s, v);
    }
  };

  const sendTransaction = async (userAddress, functionData, r, s, v) => {
    if (web3 && contract) {
      try {
        let gasLimit = await contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .estimateGas();
        let gasPrice = await web3.eth.getGasPrice();
        console.log(gasLimit);
        console.log(gasPrice);
        let tx = contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .send({
            from: userAddress,
            gasPrice: web3.utils.toHex(gasPrice),
            gasLimit: web3.utils.toHex(gasLimit),
          });

        tx.on("transactionHash", function (hash) {
          console.log(`Transaction hash is ${hash}`);
          alert(`Transaction sent by relayer with hash ${hash}`);
        }).once("confirmation", function (confirmationNumber, receipt) {
          console.log(receipt);
          alert("Transaction confirmed on chain");
          getQuoteFromNetwork();
        });
      } catch (error) {
        console.log(error);
      }
    }
  };

  const constructMetaTransactionMessage = (
    nonce,
    chainId,
    functionSignature,
    contractAddress
  ) => {
    return abi.soliditySHA3(
      ["uint256", "address", "uint256", "bytes"],
      [nonce, contractAddress, chainId, toBuffer(functionSignature)]
    );
  };
  const getSignatureParameters = (signature) => {
    if (!web3.utils.isHexStrict(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    var r = signature.slice(0, 66);
    var s = "0x".concat(signature.slice(66, 130));
    var v = "0x".concat(signature.slice(130, 132));
    v = web3.utils.hexToNumber(v);
    if (![27, 28].includes(v)) v += 27;
    return {
      r: r,
      s: s,
      v: v,
    };
  };

  return (
    <div className="App">
      {quote}
      <button onClick={getQuoteFromNetwork}>getQuoteFromNetwork</button>
      <button onClick={setQuoteOnNetwork}>setQuoteOnNetwork</button>
      <button onClick={setQuoteViaMetaTX}>setQuoteViaMetaTX</button>
    </div>
  );
}

export default App;
