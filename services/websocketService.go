package services

import (
	"crypto/tls"
	"github.com/go-resty/resty"
	"github.com/revel/revel"
	"log"
)

type QrCodeText struct {
	Type 	string		`json:"type"`
	Url 	string		`json:"url"`
}

func GetQrCode() (qrCodeText QrCodeText) {

	//didApplicationUrl := revel.Config.StringDefault("DidApplicationUrl", "http://localhost.c1dev.vivvo.com:9000")
	//
	//resty.SetTLSClientConfig(&tls.Config{InsecureSkipVerify: true})
	//resp, err := resty.R().
	//	SetHeader("Accept", "application/json").
	//	SetHeader("Authorization", "").
	//	Get(didApplicationUrl)
	//
	//if err != nil {
	//	log.Printf("Error accessing the did")
	//}


	return
}